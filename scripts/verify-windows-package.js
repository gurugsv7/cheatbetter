const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'out', 'Hintio-win32-x64');
const requiredTopLevelFiles = [
    'Hintio.exe',
    'ffmpeg.dll',
    'd3dcompiler_47.dll',
];

const optionalTopLevelRuntimeFiles = [
    'vcruntime140.dll',
    'vcruntime140_1.dll',
    'msvcp140.dll',
];

const requiredRuntimePaths = [
    path.join('resources', 'app.asar'),
    path.join('resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', 'bin'),
];

function missingEntries(base, entries) {
    return entries.filter(entry => !fs.existsSync(path.join(base, entry)));
}

function findFilesRecursively(base, predicate) {
    if (!fs.existsSync(base)) return [];
    const results = [];
    const stack = [base];

    while (stack.length > 0) {
        const current = stack.pop();
        const stat = fs.statSync(current);
        if (stat.isDirectory()) {
            for (const child of fs.readdirSync(current)) {
                stack.push(path.join(current, child));
            }
        } else if (predicate(current)) {
            results.push(current);
        }
    }

    return results;
}

function main() {
    if (!fs.existsSync(appDir)) {
        console.error(`[verify] Missing packaged app directory: ${appDir}`);
        console.error('[verify] Run `npm run package:win` or `npm run make:win` first.');
        process.exit(1);
    }

    const missingTopLevel = missingEntries(appDir, requiredTopLevelFiles);
    const missingOptionalRuntime = missingEntries(appDir, optionalTopLevelRuntimeFiles);
    const missingRuntime = missingEntries(appDir, requiredRuntimePaths);

    const onnxBinDir = path.join(appDir, 'resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', 'bin');
    const onnxBindingFiles = findFilesRecursively(onnxBinDir, filePath => path.basename(filePath).toLowerCase() === 'onnxruntime_binding.node');
    const onnxWindowsDlls = findFilesRecursively(onnxBinDir, filePath => path.basename(filePath).toLowerCase() === 'onnxruntime.dll');

    const failures = [];

    if (missingTopLevel.length > 0) {
        failures.push(`Missing top-level runtime files:\n- ${missingTopLevel.join('\n- ')}`);
    }

    if (missingRuntime.length > 0) {
        failures.push(`Missing required runtime paths:\n- ${missingRuntime.join('\n- ')}`);
    }

    if (onnxBindingFiles.length === 0) {
        failures.push('No onnxruntime binding binary found in app.asar.unpacked.');
    }

    if (onnxWindowsDlls.length === 0) {
        failures.push('No onnxruntime.dll found in app.asar.unpacked.');
    }

    if (failures.length > 0) {
        console.error('[verify] Windows package verification failed.');
        for (const failure of failures) {
            console.error(`\n${failure}`);
        }
        process.exit(1);
    }

    console.log('[verify] Windows package verification passed.');
    console.log(`[verify] Checked app directory: ${appDir}`);
    console.log(`[verify] Found ${onnxBindingFiles.length} onnxruntime binding file(s) and ${onnxWindowsDlls.length} onnxruntime.dll file(s).`);

    if (missingOptionalRuntime.length > 0) {
        console.warn('[verify] Warning: Visual C++ runtime DLLs are not bundled in this package.');
        console.warn('[verify] Some clean Windows machines may require Microsoft Visual C++ Redistributable (x64).');
        console.warn(`[verify] Missing optional runtime files:\n- ${missingOptionalRuntime.join('\n- ')}`);
    }
}

main();
