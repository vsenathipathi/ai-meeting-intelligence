# AI-Powered Meeting Insights

This project is an end-to-end Retrieval-Augmented Generation (RAG) application using **FastAPI**, **ChromaDB**, and **ReactJS**. 

## Overall Working:

Feature 1: Upload
User uploads the video/audio files using the GUI. File is stored in from local disk. This is picked and transcribed by Whisper.cpp to text file. Metadata and text is stored in sqlite table. Now, the transcribed text in chuncked and embedded to Chromadb using SentenceTransformer.

Feature 2: Getting Insights/RAG
The second GUI block lists all the stored transcriptions by Title. User selects the title and Ask the query. Upon submission, the question is embedded using SentenceTransformer. The embedded question is searched against the chromadb collections retrieving the related chunks(Context).
Both the Question and Context is passed to Ollama, which gives back the response.

## Code repository

https://github.com/vsenathipathi/ai-meeting-intelligence

## Architecture
![alt text](image.png)


## 🚀 Features
- Document ingestion with embeddings (Amazon Bedrock `titan-embed-text-v2`)
- Vector database powered by ChromaDB
- Query API with FastAPI
- React frontend for interactive querying
- Source documents displayed along with AI-generated answers

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/my-ai-app.git
cd my-ai-app
