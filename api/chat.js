export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { contents } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada na Vercel.' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("Erro na API de chat:", error);
        return res.status(500).json({ error: 'Erro interno no servidor ao chamar a API do Gemini.' });
    }
}
