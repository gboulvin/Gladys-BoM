// -----------------------------------------------------------------------------
// What Dependabot would propose, before it does.
//
//   npm run deps:check
//
// Dependabot (.github/dependabot.yml) opens a pull request for every outdated
// npm package (weekly), every new major of a GitHub Action (monthly) and every
// security advisory. Running this before each push or release lists the same
// updates, so they ship with the work instead of arriving as pull requests
// afterwards:
//   1. npm packages behind their latest version (`npm outdated`);
//   2. known vulnerabilities in the dependency tree (`npm audit`);
//   3. GitHub Actions used in .github/workflows behind their latest major tag.
//
// Exits 1 when something is outdated, with the command that fixes it. Needs
// the network: not part of `npm test` (tests never touch the network).
// -----------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS = '.github/workflows';
let problems = 0;

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    // npm outdated / npm audit exit 1 when they find something: keep their output.
    return err.stdout ?? '';
  }
}

// 1. npm packages
const outdated = JSON.parse(run('npm', ['outdated', '--json']) || '{}');
for (const [name, info] of Object.entries(outdated)) {
  problems += 1;
  console.log(
    `npm      ${name} ${info.current} -> ${info.latest}   (npm install ${name}@^${info.latest})`,
  );
}

// 2. Vulnerabilities
const audit = JSON.parse(run('npm', ['audit', '--json']) || '{}');
const vulnerable = Object.keys(audit.vulnerabilities ?? {});
if (vulnerable.length > 0) {
  problems += 1;
  console.log(`audit    ${vulnerable.join(', ')}   (npm audit fix)`);
}

// 3. GitHub Actions: compare the major pinned in the workflows with the
// highest `vN` tag of the action's repository.
const used = new Map(); // action -> Set of pinned majors
for (const file of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
  const text = readFileSync(join(WORKFLOWS, file), 'utf8');
  for (const [, action, ref] of text.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@(v\d+)\b/g)) {
    if (!used.has(action)) used.set(action, new Set());
    used.get(action).add(ref);
  }
}
for (const [action, refs] of used) {
  const tags = run('git', ['ls-remote', '--tags', `https://github.com/${action}`]);
  const majors = [...tags.matchAll(/refs\/tags\/v(\d+)$/gm)].map((m) => Number(m[1]));
  if (majors.length === 0) {
    console.log(`action   ${action}: could not read the tags, check it by hand`);
    continue;
  }
  const latest = Math.max(...majors);
  for (const ref of refs) {
    if (Number(ref.slice(1)) < latest) {
      problems += 1;
      console.log(`action   ${action}@${ref} -> v${latest}   (read its release notes first)`);
    }
  }
}

if (problems === 0) {
  console.log('Everything is up to date: Dependabot has nothing to propose.');
} else {
  process.exitCode = 1;
}
