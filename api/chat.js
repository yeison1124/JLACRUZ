/**
 * api/chat.js — Vercel Serverless Function
 * 
 * Esta función se ejecuta en los servidores de Vercel del lado del SERVIDOR.
 * Lee la llave secreta desde las Variables de Entorno de Vercel (process.env.CHATBOT_SECRET_KEY)
 * y la adjunta a las cabeceras HTTP enviadas al microservicio.
 * 
 * NUNCA expone la llave secreta al navegador del cliente.
 */

export default async function handler(req, res) {
  // Permitir métodos POST y OPTIONS (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  try {
    const { mensaje } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    // 1. Extraer variables de entorno configuradas en el panel de Vercel
    const secretKey = process.env.CHATBOT_SECRET_KEY || '';
    const microserviceUrl = process.env.MICROSERVICE_URL || 'https://jlacruzca.com/?views=chatbot';

    // 2. Transmitir petición al microservicio agregando la llave en los headers
    const response = await fetch(microserviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'X-Secret-Key': secretKey,
        'X-Internal-Token': secretKey,
        'X-Origin-Domain': req.headers.host || 'vercel'
      },
      body: JSON.stringify({
        mensaje: mensaje.trim(),
        secret_key: secretKey,
        origen: 'vercel_serverless'
      })
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error en Vercel Serverless Function /api/chat:', error);
    return res.status(500).json({
      error: 'Error interno al comunicarse con el microservicio desde Vercel.',
      detalle: error.message
    });
  }
}
