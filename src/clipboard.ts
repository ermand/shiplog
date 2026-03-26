// Cross-platform clipboard copy

export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform

  let cmd: string
  let args: string[]

  if (platform === 'darwin') {
    cmd = 'pbcopy'
    args = []
  } else if (platform === 'win32') {
    cmd = 'clip'
    args = []
  } else {
    // Linux — try xclip, fall back to xsel
    cmd = 'xclip'
    args = ['-selection', 'clipboard']
  }

  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: 'pipe',
      stdout: 'ignore',
      stderr: 'ignore',
    })
    proc.stdin.write(text)
    proc.stdin.end()
    const exitCode = await proc.exited
    return exitCode === 0
  } catch {
    console.error('Warning: clipboard copy failed. Install pbcopy (macOS), clip (Windows), or xclip (Linux).')
    return false
  }
}
