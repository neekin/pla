import { useState } from 'react';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import './App.css';

const trpcClient = createTRPCUntypedClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      transformer: superjson,
    }),
  ],
});

function App() {
  const [name, setName] = useState('Vite React');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const callTrpc = async () => {
    setLoading(true);

    try {
      const response = (await trpcClient.query('hello', { name })) as {
        greeting: string;
      };
      setResult(response.greeting);
    } catch {
      setResult('调用失败，请确认 Nest 服务已启动在 3000 端口。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>NestJS + Vite React + tRPC</h1>
      <p>输入名字，点击按钮调用 Nest 后端 tRPC 接口。</p>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="输入名字"
        style={{ width: '100%', padding: 10, marginBottom: 12 }}
      />

      <button onClick={callTrpc} disabled={loading} style={{ padding: '8px 16px' }}>
        {loading ? '调用中...' : '调用 tRPC'}
      </button>

      {result ? <p style={{ marginTop: 16 }}>返回结果：{result}</p> : null}
    </main>
  );
}

export default App;
