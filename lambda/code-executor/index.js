/**
 * AWS Lambda function for secure code execution
 * Executes user code in isolated environment with timeouts and resource limits
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const TIMEOUT_MS = 5000; // 5 seconds max
const MAX_OUTPUT_SIZE = 10000; // 10KB max output

/**
 * Main handler function
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const { language, code } = event;

    if (!language || !code) {
      return {
        success: false,
        error: 'Missing language or code',
      };
    }

    const result = await executeCode(language, code);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Execution error:', error);
    return {
      success: false,
      error: error.message || 'Code execution failed',
    };
  }
};

/**
 * Execute code based on language
 */
async function executeCode(language, code) {
  const tmpDir = '/tmp';
  const startTime = Date.now();

  try {
    switch (language) {
      case 'python':
        return await executePython(code, tmpDir);
      case 'java':
        return await executeJava(code, tmpDir);
      case 'cpp':
        return await executeCpp(code, tmpDir);
      case 'csharp':
        return await executeCSharp(code, tmpDir);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  } finally {
    const executionTime = Date.now() - startTime;
    console.log(`Execution time: ${executionTime}ms`);
  }
}

/**
 * Execute Python code
 */
async function executePython(code, tmpDir) {
  const fileName = path.join(tmpDir, `script_${Date.now()}.py`);

  try {
    await fs.writeFile(fileName, code);

    const result = await runCommand('python3', [fileName], TIMEOUT_MS);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      executionTime: result.executionTime,
    };
  } finally {
    await fs.unlink(fileName).catch(() => {});
  }
}

/**
 * Execute Java code
 */
async function executeJava(code, tmpDir) {
  // Extract class name from code
  const classNameMatch = code.match(/public\s+class\s+(\w+)/);
  const className = classNameMatch ? classNameMatch[1] : 'Main';
  const fileName = path.join(tmpDir, `${className}.java`);

  try {
    await fs.writeFile(fileName, code);

    // Compile
    const compileResult = await runCommand('javac', [fileName], TIMEOUT_MS);
    if (compileResult.stderr) {
      return {
        stdout: '',
        stderr: compileResult.stderr,
        executionTime: compileResult.executionTime,
      };
    }

    // Execute
    const result = await runCommand('java', ['-cp', tmpDir, className], TIMEOUT_MS);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      executionTime: result.executionTime,
    };
  } finally {
    await fs.unlink(fileName).catch(() => {});
    await fs.unlink(path.join(tmpDir, `${className}.class`)).catch(() => {});
  }
}

/**
 * Execute C++ code
 */
async function executeCpp(code, tmpDir) {
  const sourceFile = path.join(tmpDir, `program_${Date.now()}.cpp`);
  const outputFile = path.join(tmpDir, `program_${Date.now()}.out`);

  try {
    await fs.writeFile(sourceFile, code);

    // Compile
    const compileResult = await runCommand('g++', [sourceFile, '-o', outputFile], TIMEOUT_MS);
    if (compileResult.stderr) {
      return {
        stdout: '',
        stderr: compileResult.stderr,
        executionTime: compileResult.executionTime,
      };
    }

    // Execute
    const result = await runCommand(outputFile, [], TIMEOUT_MS);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      executionTime: result.executionTime,
    };
  } finally {
    await fs.unlink(sourceFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
  }
}

/**
 * Execute C# code
 */
async function executeCSharp(code, tmpDir) {
  const fileName = path.join(tmpDir, `Program_${Date.now()}.cs`);

  try {
    await fs.writeFile(fileName, code);

    // Compile and execute with csc (mono or dotnet)
    const result = await runCommand('mcs', [fileName, '-out:output.exe'], TIMEOUT_MS);
    if (result.stderr) {
      return {
        stdout: '',
        stderr: result.stderr,
        executionTime: result.executionTime,
      };
    }

    // Execute
    const execResult = await runCommand('mono', ['output.exe'], TIMEOUT_MS);

    return {
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      executionTime: execResult.executionTime,
    };
  } finally {
    await fs.unlink(fileName).catch(() => {});
    await fs.unlink('output.exe').catch(() => {});
  }
}

/**
 * Run a shell command with timeout
 */
function runCommand(command, args, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const process = spawn(command, args, {
      timeout,
      killSignal: 'SIGKILL',
    });

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT_SIZE) {
        process.kill('SIGKILL');
        reject(new Error('Output size exceeded limit'));
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT_SIZE) {
        process.kill('SIGKILL');
        reject(new Error('Error output size exceeded limit'));
      }
    });

    process.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        executionTime,
      });
    });

    process.on('error', (error) => {
      reject(error);
    });

    // Timeout handler
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
        reject(new Error('Execution timeout exceeded'));
      }
    }, timeout);
  });
}
