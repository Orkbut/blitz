// API de teste simples
export async function GET() {
  return new Response(JSON.stringify({
    success: true,
    message: "RADAR API funcionando!",
    timestamp: new Date().toISOString(),
    status: "OK"
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST() {
  return new Response(JSON.stringify({
    success: true,
    message: "POST funcionando!",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
} 