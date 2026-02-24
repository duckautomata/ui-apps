/**
 * Usage: node ./scripts/update-sites.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The current repo's root (parent of /scripts)
const CURRENT_REPO_ROOT = path.resolve(__dirname, '..');
// The parent directory containing all repos
const PARENT_DIR = path.resolve(CURRENT_REPO_ROOT, '..');

const REPOS = [
    'archived-transcript',
    'dokimotes',
    'live-transcript',
    'dokisnake',
    'simple-text'
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('Available Repositories to Update:');
    REPOS.forEach((repo, index) => {
        console.log(`${index + 1}. ${repo}`);
    });
    const answer = await askQuestion('\nEnter the numbers of the repos to update (comma separated, e.g., "1,3"): ');
    const indices = answer.split(',').map(s => parseInt(s.trim()) - 1).filter(i => !isNaN(i) && i >= 0 && i < REPOS.length);

    if (indices.length === 0) {
        console.log('No valid repositories selected. Exiting.');
        rl.close();
        return;
    }

    const selectedRepos = indices.map(i => REPOS[i]);
    console.log(`\nSelected: ${selectedRepos.join(', ')}\n`);

    for (const repo of selectedRepos) {
        try {
            console.log(`\n--- Processing ${repo} ---`);
            const repoPath = path.join(PARENT_DIR, repo);

            if (!fs.existsSync(repoPath)) {
                console.error(`Error: Repository path not found: ${repoPath}`);
                continue;
            }

            // 1. Delete old build folder in CURRENT repo
            const targetPath = path.join(CURRENT_REPO_ROOT, repo);
            if (fs.existsSync(targetPath)) {
                console.log(`Deleting old build folder: ${targetPath}`);
                fs.rmSync(targetPath, { recursive: true, force: true });
            }

            // 2. Build in SIBLING repo
            console.log(`Installing dependencies in ${repo}...`);
            execSync('npm install', { cwd: repoPath, stdio: 'inherit' });

            console.log(`Formatting code in ${repo}...`);
            try {
                execSync('npm run format', { cwd: repoPath, stdio: 'inherit' });
            } catch (e) {
                console.warn(`Warning: 'npm run format' failed or script missing in ${repo}. Continuing...`);
            }

            console.log(`Linting code in ${repo}...`);
            execSync('npm run lint', { cwd: repoPath, stdio: 'inherit' });

            console.log(`Building ${repo}...`);
            execSync('npm run build', { cwd: repoPath, stdio: 'inherit' });

            // 3. Find and Move build folder
            let buildPath = path.join(repoPath, repo); // Check for same-named folder first
            if (!fs.existsSync(buildPath)) {
                buildPath = path.join(repoPath, 'dist');
                if (!fs.existsSync(buildPath)) {
                    buildPath = path.join(repoPath, 'build');
                }
            }

            if (!fs.existsSync(buildPath)) {
                throw new Error(`Could not find build output in ${repo} (checked /${repo}, /dist, /build)`);
            }

            console.log(`Moving build from ${buildPath} to ${targetPath}...`);
            fs.renameSync(buildPath, targetPath);

            console.log(`Successfully updated ${repo}!`);

        } catch (error) {
            console.error(`\nFAILED to process ${repo}:`);
            console.error(error.message);
        }
    }

    console.log('\nAll tasks completed.');
    rl.close();
}

main();
