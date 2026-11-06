import { execFile } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { nanoid } from 'nanoid'
import fs from 'fs-extra'

import { createGit } from '../../lib/git.js'

let spawn = promisify(execFile)
let currentDir = dirname(fileURLToPath(import.meta.url))
let cwd = resolve(currentDir, `nano-staged-${nanoid()}`)
let runners = ['lint-staged', 'nano-staged', 'prek', 'lefthook']
let before

async function makeDir(dir = cwd) {
  await fs.mkdir(dir)
}

async function appendFile(filename, content, dir = cwd) {
  await fs.appendFile(resolve(dir, filename), content)
}

async function execGit(args) {
  let git = createGit(cwd)
  await git.exec(args, { cwd })
}

async function initGitRepo() {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await execGit(['config', 'commit.gpgsign', 'false'])
  await appendFile('README.md', '# Test\n')
  await appendFile('.gitignore', `node_modules/\n`)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
}

async function initProject() {
  await appendFile(
    'package.json',
    `{
      "lint-staged": {
        "*.js": "prettier --write",
        "*.css": "prettier --write"
      },
      "nano-staged": {
        "*.js": "prettier --write",
        "*.css": "prettier --write"
      }
    }`,
  )
  await appendFile(
    'pnpm-workspace.yaml',
    `
allowBuilds:
  lefthook: true`,
  )
  await appendFile(
    'prek.toml',
    `
[[repos]]
repo = "local"

[[repos.hooks]]
id = "prettier"
name = "prettier"
language = "system"
entry = "prettier --write"
pass_filenames = true
files = { glob = ["*.js", "*.css"] }`,
  )
  await appendFile(
    'lefthook.yml',
    `
pre-commit:
  commands:
    prettier:
      glob: "*.{js,css}"
      run: node --run prettier --write {staged_files}
`,
  )

  await spawn('pnpm', ['add', 'lint-staged'], { cwd })
  await spawn('pnpm', ['add', 'lefthook'], { cwd })
  await spawn('pnpm', ['add', '@j178/prek'], { cwd })
  await spawn('pnpm', ['add', resolve(cwd, '../../../../nano-staged')], {
    cwd,
  })
  await appendFile('a.js', 'var test = {};')
  await appendFile('b.js', 'var test = {};')
  await appendFile('c.js', 'var test = {};')
  await appendFile('d.js', 'var test = {};')
  await appendFile('e.js', 'var test = {};')
  await appendFile('a.css', 'body {color: red;}')
  await appendFile('b.css', 'body {color: red;}')
  await appendFile('c.css', 'body {color: red;}')
  await appendFile('d.css', 'body {color: red;}')
  await appendFile('e.css', 'body {color: red;}')

  await execGit(['add', '--all'])
}

function showTime(name) {
  let prefix = name === 'nano-staged' ? '+ ' : '- '
  let after = performance.now()
  let time = (Math.round(after - before) / 1000)
    .toString()
    .replace(/\.\d$/, '$&00')
    .replace(/\.\d\d$/, '$&0')
  process.stdout.write(prefix + name + '\x1B[1m' + time.padStart(6) + '\x1B[22m ms\n')
}

async function run() {
  for (let runner of runners) {
    before = performance.now()
    await spawn(`./node_modules/.bin/${runner}`, { cwd })
    showTime(runner)
  }
}

await makeDir()
await initGitRepo()
await initProject()
await run()

await fs.remove(cwd)
