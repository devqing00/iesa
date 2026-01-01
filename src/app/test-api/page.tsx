'use client';

import { useState } from 'react';

interface TestResult {
  title: string;
  message: string;
  success: boolean;
}

export default function ApiTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (title: string, message: string, success: boolean) => {
    setResults(prev => [...prev, { title, message, success }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const test1_DirectBackend = async () => {
    try {
      const res = await fetch('http://localhost:8000/health');
      const data = await res.json();
      
      if (res.ok && data.status === 'ok') {
        addResult('✅ Test 1: Direct Backend', 
          `Backend is running on port 8000\nResponse: ${JSON.stringify(data)}`, 
          true);
      } else {
        addResult('❌ Test 1: Direct Backend', 
          `Unexpected response: ${JSON.stringify(data)}`, 
          false);
      }
    } catch (error: any) {
      addResult('❌ Test 1: Direct Backend', 
        `Backend not accessible: ${error.message}`, 
        false);
    }
  };

  const test2_NextJSRewrite = async () => {
    try {
      // This should rewrite to backend
      const res = await fetch('/api/users/me', {
        headers: {
          'Authorization': 'Bearer fake-token'
        }
      });
      
      // We expect 401 (Unauthorized) because token is fake
      // If we get 404, rewrites aren't working
      if (res.status === 401) {
        addResult('✅ Test 2: Next.js Rewrites', 
          `Rewrites working! Got 401 (expected for fake token)\nThis proves Next.js → Backend communication works`, 
          true);
      } else if (res.status === 404) {
        addResult('❌ Test 2: Next.js Rewrites', 
          `Got 404 - Rewrites NOT working!\nNext.js couldn't find the route`, 
          false);
      } else {
        const text = await res.text();
        addResult('⚠️ Test 2: Next.js Rewrites', 
          `Got status ${res.status}\nResponse: ${text}`, 
          res.ok);
      }
    } catch (error: any) {
      addResult('❌ Test 2: Next.js Rewrites', 
        `Request failed: ${error.message}`, 
        false);
    }
  };

  const test3_StudentRegistration = async () => {
    try {
      const res = await fetch('/api/v1/students/complete-registration', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matricNumber: '123456',
          level: 100
        })
      });
      
      if (res.status === 401) {
        addResult('✅ Test 3: Student Registration Endpoint', 
          `Endpoint reachable! Got 401 (expected for fake token)\nRegistration endpoint is properly proxied`, 
          true);
      } else if (res.status === 404) {
        addResult('❌ Test 3: Student Registration Endpoint', 
          `Got 404 - Endpoint not found!\nCheck backend router configuration`, 
          false);
      } else {
        const text = await res.text();
        addResult('⚠️ Test 3: Student Registration Endpoint', 
          `Got status ${res.status}\nResponse: ${text.substring(0, 200)}`, 
          res.ok);
      }
    } catch (error: any) {
      addResult('❌ Test 3: Student Registration Endpoint', 
        `Request failed: ${error.message}`, 
        false);
    }
  };

  const test4_UsersEndpoint = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firebaseUid: 'test-uid',
          email: 'test@test.com'
        })
      });
      
      if (res.status === 401 || res.status === 422) {
        addResult('✅ Test 4: Users Endpoint', 
          `Endpoint reachable! Got ${res.status}\nUsers endpoint is properly proxied`, 
          true);
      } else if (res.status === 404) {
        addResult('❌ Test 4: Users Endpoint', 
          `Got 404 - Endpoint not found!`, 
          false);
      } else {
        const text = await res.text();
        addResult('⚠️ Test 4: Users Endpoint', 
          `Got status ${res.status}\nResponse: ${text.substring(0, 200)}`, 
          res.ok);
      }
    } catch (error: any) {
      addResult('❌ Test 4: Users Endpoint', 
        `Request failed: ${error.message}`, 
        false);
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    clearResults();
    
    addResult('🚀 Starting Tests...', 'Testing backend connectivity, rewrites, and endpoints', true);
    
    await test1_DirectBackend();
    await new Promise(r => setTimeout(r, 500));
    
    await test2_NextJSRewrite();
    await new Promise(r => setTimeout(r, 500));
    
    await test3_StudentRegistration();
    await new Promise(r => setTimeout(r, 500));
    
    await test4_UsersEndpoint();
    
    addResult('✅ Tests Complete', 'Check results above', true);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-[var(--foreground)]">
          IESA API Test Suite
        </h1>
        
        <div className="mb-8 flex gap-4">
          <button
            onClick={runAllTests}
            disabled={testing}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:opacity-80 disabled:opacity-50"
          >
            {testing ? 'Running Tests...' : 'Run All Tests'}
          </button>
          
          <button
            onClick={clearResults}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:opacity-80"
          >
            Clear Results
          </button>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-6 rounded-lg border-2 ${
                result.success 
                  ? 'bg-green-50 border-green-500 dark:bg-green-900/20' 
                  : 'bg-red-50 border-red-500 dark:bg-red-900/20'
              }`}
            >
              <h3 className="font-bold text-lg mb-2">{result.title}</h3>
              <pre className="whitespace-pre-wrap text-sm opacity-80">
                {result.message}
              </pre>
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            Click "Run All Tests" to start testing the API configuration
          </div>
        )}
      </div>
    </div>
  );
}
