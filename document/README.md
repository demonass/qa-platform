# Document Directory

This directory is used to store document files for the QA Platform knowledge base.

## Purpose

Documents placed in this directory will be processed by the RAG (Retrieval-Augmented Generation) system to provide context-aware responses to user queries.

## Supported Formats

- `.txt` - Plain text files
- `.md` - Markdown files
- `.pdf` - PDF documents
- `.docx` - Microsoft Word documents

## Usage

1. Place your knowledge base documents in this directory
2. The system will automatically load and process these documents
3. Documents will be embedded and indexed for fast retrieval

## Notes

- Large files (>10MB) may affect processing performance
- It's recommended to keep documents organized in subdirectories by topic
- Documents should be in Chinese for optimal performance with the current embedding models