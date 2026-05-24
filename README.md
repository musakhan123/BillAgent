# Bijli Agent — AI-Powered Electricity Bill Checker

> **University Hackathon Project** | Team **TeraByte**

Bijli Agent lets Pakistani electricity consumers upload their PESCO bill (image or PDF) and instantly find out if they were overcharged. It reads the bill using AI, recalculates the correct amount against official NEPRA tariff slabs, and — if overbilling is detected — drafts a ready-to-send formal complaint letter addressed to PESCO (CC: NEPRA).

---

## Team

| Name | Role |
|---|---|
| **Muhammad Musa** | Team Member |
| **Muhammad Zikria Shah** | Team Member |
| **Hajia Akhlaq** | Team Member |

---

## Features

- Upload a bill as **JPG, PNG, WebP, GIF, or PDF** (up to 20 MB)
- AI-powered OCR extracts all bill fields using **Google Gemini**
- Recalculates charges using **NEPRA 2025-26 progressive slab rates**
- Supports both **standard** and **protected** consumer categories
- Supports **solar / net-metering** bills (imported vs. exported units)
- Returns one of three verdicts:
  - **Overbilled** — shows exact overcharge amount + auto-drafted complaint letter
  - **Correct** — confirms the bill matches NEPRA tariff
  - **Credit** — flags bills where you are owed money (not to be paid)

---

## Tech Stack

- **Runtime**: Node.js + Express
- **AI / OCR**: Google Gemini 2.5 Flash via LangChain (`@langchain/google-genai`)
- **PDF processing**: pdf-poppler
- **Web scraping**: Puppeteer-core
- **File uploads**: Multer

---

## Prerequisites

Install these before running the project:

### 1. Node.js 18+
Download from https://nodejs.org (LTS version recommended).

### 2. Poppler (PDF to image conversion)
`pdf-poppler` is a wrapper around the Poppler CLI tool — it must be installed separately.

- **Windows**: Download from https://github.com/oschwartz10612/poppler-windows/releases  
  Extract the zip, then add the `Library/bin` folder to your system PATH.
- **macOS**: `brew install poppler`
- **Ubuntu/Debian**: `sudo apt install poppler-utils`

---

## Setup & Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/BillAgent.git
cd BillAgent

# 2. Install dependencies
npm install

# 3. Create your environment file
#    Copy the example and fill in your values (see Environment Variables below)
cp .env.example .env
```

---

## Environment Variables

Open `.env` and fill in the following:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key — get one free at https://aistudio.google.com |
| `PORT` | Port to run the server on (default: `3000`) |

---

## Running the App

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

Then open your browser at: **http://localhost:3000**

---

## API

The server exposes a single endpoint:

### `POST /analyze`

Upload a bill file and receive the analysis result.

**Request** — `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `bill` | File | JPG, PNG, WebP, GIF, or PDF (max 20 MB) |

**Response** — JSON

```json
{
  "billData": { ... },
  "discrepancy": { "isOverbilled": true, "difference": 450.00, ... },
  "verdict": {
    "status": "overbilled",
    "message": "You were overcharged by PKR 450.00. Correct bill: PKR 1200.00."
  },
  "complaintDraft": {
    "to": "complaints@pesco.gov.pk",
    "cc": "complaint@nepra.org.pk",
    "subject": "Overbilling Complaint — Consumer ID: ...",
    "body": "..."
  }
}
```

`status` is one of: `"overbilled"` | `"correct"` | `"credit"`  
`complaintDraft` is only present when `status` is `"overbilled"`.
