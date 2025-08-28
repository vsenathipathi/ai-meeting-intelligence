from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sqlite3
import requests
import os
import traceback
from typing import List
from chromadb.config import Settings
from chromadb import PersistentClient
from pydantic import BaseModel

app = FastAPI()
# CORS, now I allow all. Need to restrict the specific S3/Cloudfront.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI automatically validates incoming JSON to this structure.
class QueryRequest(BaseModel):
    meeting_id: int
    question: str

#Import of libraries
try:
    from sentence_transformers import SentenceTransformer
    _SENTENCE_TRANSFORMER_AVAILABLE = True
except Exception:
    _SENTENCE_TRANSFORMER_AVAILABLE = False

try:
    import openai
    _OPENAI_AVAILABLE = True
except Exception:
    _OPENAI_AVAILABLE = False

try:
    import chromadb
    from chromadb.config import Settings
    _CHROMADB_AVAILABLE = True
except Exception:
    _CHROMADB_AVAILABLE = False



DB_PATH = "meetings.db"
UPLOAD_DIR = "uploads"
CHROMA_DIR = "chromadb_persist"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

# Initialize SQLite
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        transcript TEXT,
        insights TEXT
    )
    """)
    conn.commit()
    conn.close()

init_db()

# Initialize Chromadb client (new client API)
_chroma_client = None
_chroma_collection = None
if _CHROMADB_AVAILABLE:
    try:
        # this is new client API fro chroma
        _chroma_client = PersistentClient(path=CHROMA_DIR)
        _chroma_collection = _chroma_client.get_or_create_collection(
            name="meetings",
            metadata={"description": "Meeting transcripts embeddings"},
        )
        print("Chroma collection initialized successfully.")
    except Exception as e:
        print("Failed to initialize Chroma client:", e)
        _chroma_client = None
        _chroma_collection = None

# Initialize embedding model. 
# to pip install sentence-transformers... have big disk space. and min 4vCPU and 8GB RAM. else it will timeout.
_sentence_model = None
if _SENTENCE_TRANSFORMER_AVAILABLE:
    try:
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        _sentence_model = None

#
def get_embeddings(texts: List[str]) -> List[List[float]]:
    print("Generating embeddings...")
    if not texts:
        print("No texts provided for embedding.")
        return []
    if _sentence_model is not None:
        print("Using SentenceTransformer for embeddings.")
        embeddings = _sentence_model.encode(texts, show_progress_bar=False)
        return [e.tolist() if hasattr(e, 'tolist') else list(e) for e in embeddings]
    api_key = os.getenv("OPENAI_API_KEY")
    if _OPENAI_AVAILABLE and api_key:
        print("Using OpenAI for embeddings.")
        openai.api_key = api_key
        resp = openai.Embedding.create(model="text-embedding-3-small", input=texts)
        return [r['embedding'] for r in resp['data']]
    raise RuntimeError("No embedding method available")

#split text into chunks 1000 char.. copied. check
def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    if not text:
        return []
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk.strip())
        start = end - overlap
    return [c for c in chunks if c]


@app.post("/upload")
async def upload_meeting(file: UploadFile = File(...)):
    transcript_success = False
    db_success = False
    chroma_success = False

    try:
        # Save uploaded file
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Transcribe using whisper.cpp
        whisper_cmd = [
            "/root/whisper.cpp/build/bin/whisper-cli",
            "-m", "/root/whisper.cpp/models/ggml-base.en.bin",
            "-f", file_path,
            "-otxt"
        ]
        try:
            subprocess.run(whisper_cmd, check=True)
            transcript_file = file_path + ".txt"
            with open(transcript_file, "r", encoding="utf-8") as f:
                transcript = f.read()
            transcript_success = True
        except Exception:
            transcript = ""
            transcript_success = False

        # Save to SQLite
        try:
            print("Saving to database...")
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute(
                "INSERT INTO meetings (title, transcript, insights) VALUES (?, ?, ?)",
                (file.filename, transcript, "")
            )
            conn.commit()
            row_id = c.lastrowid
            conn.close()
            db_success = True
        except Exception:
            db_success = False

        # Chroma embeddings
        try:
            print("Starting text chunking...")
            chunks = chunk_text(transcript)
            print(f"Generated {len(chunks)} chunks for embedding.")
            embeddings = get_embeddings(chunks)
            print(f"Generated embeddings for {len(embeddings)} chunks.")

            # Provide unique IDs per chunk
            ids = [f"{row_id}-{i}" for i in range(len(chunks))]
            metadatas = [{"title": file.filename, "meeting_id": row_id, "chunk_index": i} for i in range(len(chunks))]

            print("Adding to ChromaDB...")
            print(ids)
            print(metadatas)

            _chroma_collection.add(
                ids=ids,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas
            )

            chroma_success = True
                # --- Check contents of the collection ---
            print("Verifying collection contents...")
            # Fetch everything except ids
            result = _chroma_collection.get(include=["documents", "metadatas", "embeddings"])

            for i, doc in enumerate(result["documents"]):
                print(f"Document {i}: {doc}")
                print(f"Metadata {i}: {result['metadatas'][i]}")
                print(f"Embedding length {i}: {len(result['embeddings'][i])}")
                print("---")

        except Exception as e:
            print("Chroma embedding failed:", e)
            chroma_success = False

        return {
            "success": transcript_success and db_success,
            "transcript_success": transcript_success,
            "db_success": db_success,
            "chroma_success": chroma_success
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/records")
def list_records():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id,title,transcript, insights FROM meetings ORDER BY id ASC")
    rows = c.fetchall()
    conn.close()

    return [
        {"id": r[0], "title": r[1], "transcript": r[2], "insights": r[3]}
        for r in rows
    ]

# Request body schema
class QueryRequest(BaseModel):
    meeting_id: int
    question: str

@app.post("/query")
def query_meeting(payload: QueryRequest):
    """
    POST /query
    Body: { "meeting_id": <int>, "question": "<text>" }
    Returns: {
      "success": True,
      "question": "...",
      "answer": "...",        # Ollama's response
      "matches": {...}        # raw chroma query result (documents/metadatas/distances)
    }
    """
    if _chroma_collection is None:
        raise HTTPException(status_code=500, detail="Chroma collection not initialized")

    meeting_id = payload.meeting_id
    question = payload.question or ""

    try:
        # 1) Embed the question
        embeddings = get_embeddings([question])
        if not embeddings:
            raise RuntimeError("Embedding generation failed or no embedding backend available")
        q_emb = embeddings[0]

        # 2) Query Chroma (filter by meeting_id metadata)
        # n_results: change as needed (top-k)
        results = _chroma_collection.query(
            query_embeddings=[q_emb],
            n_results=5,
            where={"meeting_id": meeting_id},
            include=["documents", "metadatas", "distances"]
        )

        # results structure: documents -> list of lists (one list per query)
        retrieved_docs = results.get("documents", [[]])[0]
        retrieved_metas = results.get("metadatas", [[]])[0]

        # 3) Build prompt for Ollama
        if retrieved_docs:
            # combine a few top docs into context (trim if very long)
            context_parts = []
            for i, d in enumerate(retrieved_docs):
                # sanitize and truncate each chunk (optional)
                snippet = d if len(d) <= 2000 else d[:2000] + "..."
                meta = retrieved_metas[i] if i < len(retrieved_metas) else {}
                context_parts.append(f"[chunk {i} | meta={meta}]\n{snippet}")
            context = "\n\n".join(context_parts)
        else:
            context = "No relevant context found for the question."

        prompt = (
            "You are given extracted meeting transcript chunks and a user question.\n\n"
            f"Context:\n{context}\n\n"
            f"Question:\n{question}\n\n"
            "Provide a concise answer based on the context. Include action items, decisions, "
            "and references to chunk indices where relevant. If context is insufficient, say so."
        )
        print("Constructed prompt for Ollama:")
        print(prompt)

        # 4) Call Ollama (adjust model name if needed)
        ollama_payload = {"model": "gemma:2b", "prompt": prompt, "stream": False}
        try:
            print("Sending request to Ollama...") # run.. ollama server &
            ollama_res = requests.post("http://localhost:11434/api/generate", json=ollama_payload, timeout=300)
        except Exception as e:
            # Ollama not reachable or network error
            ollama_res = None
            ollama_error = str(e)

        if ollama_res is None:
            answer = f"Ollama request failed: {ollama_error}"
        elif not ollama_res.ok:
            # return status + body if non-200
            try:
                body = ollama_res.json()
            except Exception:
                body = ollama_res.text
            answer = f"Ollama returned status {ollama_res.status_code}: {body}"
        else:
            # parse Ollama JSON response (try common keys)
            try:
                jr = ollama_res.json()
                answer = jr.get("response") or jr.get("generated") or jr.get("result") or str(jr)
            except Exception:
                answer = ollama_res.text

        # 5) Return everything (frontend expects .answer and .matches)
        return {
            "success": True,
            "question": question,
            "answer": answer,
            "matches": results
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))