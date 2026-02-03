#!/usr/bin/env node

import { execSync } from 'child_process';

const REMOTE_URL = 'https://github.com/facottry/foundry-app-server.git';

function run(cmd) {
    console.log(`\n▶ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
}

console.log('🚨 WARNING');
console.log('This will REWRITE git history and remove .env files permanently.');
console.log('Press Ctrl+C to abort.\n');

run('git status');

console.log('\n🧹 Removing .env files from entire git history');
run(
    'git filter-repo ' +
    '--path .env ' +
    '--path .env.production ' +
    '--invert-paths ' +
    '--force'
);

console.log('\n🔗 Ensuring origin remote exists');
try {
    run(`git remote add origin ${REMOTE_URL}`);
} catch {
    run(`git remote set-url origin ${REMOTE_URL}`);
}

run('git remote -v');

console.log('\n🚀 Force-pushing clean history to main');
run('git push -f origin main');

console.log('\n🔥 Force-pushing to PRODUCTION_DEPLOYMENT (one-time realign)');
run('git push -f origin main:PRODUCTION_DEPLOYMENT');

console.log('\n✅ DONE');
console.log('✔ .env files removed from history');
console.log('✔ main + PRODUCTION_DEPLOYMENT aligned');
console.log('✔ Repo clean');
