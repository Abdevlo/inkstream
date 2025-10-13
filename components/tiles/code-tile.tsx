'use client';

import { useState } from 'react';
import { TileWrapper } from './tile-wrapper';
import { Button } from '@/components/ui/button';
import Editor from '@monaco-editor/react';
import { CodeLanguage } from '@/types';
import toast from 'react-hot-toast';
import { copyToClipboard } from '@/lib/utils/session-helpers';

interface CodeTileProps {
  id: string;
  onClose?: () => void;
}

const languageTemplates: Record<CodeLanguage, string> = {
  python: `# Python code
print("Hello, World!")

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(f"Factorial of 5: {factorial(5)}")`,
  java: `// Java code
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  cpp: `// C++ code
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  csharp: `// C# code
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`,
};

export function CodeTile({ id, onClose }: CodeTileProps) {
  const [language, setLanguage] = useState<CodeLanguage>('python');
  const [code, setCode] = useState(languageTemplates.python);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleLanguageChange = (newLang: CodeLanguage) => {
    setLanguage(newLang);
    setCode(languageTemplates[newLang]);
    setOutput('');
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');

    try {
      // Call API route to execute code
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          code,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const output = result.data.stdout || result.data.stderr || 'No output';
        setOutput(output);
      } else {
        setOutput(`Error: ${result.error}`);
        toast.error('Failed to execute code');
      }
    } catch (error: any) {
      console.error('Code execution error:', error);
      setOutput(`Error: ${error.message}`);
      toast.error('Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyCode = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      toast.success('Code copied to clipboard');
    } else {
      toast.error('Failed to copy code');
    }
  };

  return (
    <TileWrapper
      id={id}
      title="Code Compiler"
      onClose={onClose}
      initialWidth={600}
      initialHeight={500}
    >
      <div className="h-full flex flex-col">
        {/* Language Selector */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex gap-2">
            {(['python', 'java', 'cpp', 'csharp'] as CodeLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === lang
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {lang === 'cpp' ? 'C++' : lang === 'csharp' ? 'C#' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={handleCopyCode}
            className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>

        {/* Code Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language === 'csharp' ? 'csharp' : language}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Run Button */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <Button
            onClick={handleRunCode}
            isLoading={isRunning}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Code
          </Button>
        </div>

        {/* Output Console */}
        <div className="h-32 border-t border-gray-200 bg-gray-900 text-green-400 font-mono text-sm p-3 overflow-auto">
          <div className="text-gray-500 text-xs mb-1">Output:</div>
          <pre className="whitespace-pre-wrap">{output || 'No output yet. Click "Run Code" to execute.'}</pre>
        </div>
      </div>
    </TileWrapper>
  );
}
