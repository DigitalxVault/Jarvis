import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as Blob | null

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData()
    whisperForm.append('file', audioFile, 'audio.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperForm,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Whisper API error:', response.status, error)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })
  } catch (err) {
    console.error('Whisper route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
