const fs = require('fs');
const path = require('path');

function getDoneFile() {
    const dataDir = process.env.FENBI_DATA_DIR || path.join(__dirname, '../../data');
    return path.join(dataDir, 'xingce_done.json');
}

function ensureDirForFile(file) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDoneIds() {
    try {
        const file = getDoneFile();
        if (fs.existsSync(file)) {
            const arr = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (Array.isArray(arr)) return new Set(arr.map(String));
        }
    } catch (e) {
        console.error('Load xingce done ids error:', e);
    }
    return new Set();
}

function addDoneIds(ids) {
    const done = loadDoneIds();
    if (Array.isArray(ids)) {
        ids.forEach(id => {
            if (id !== undefined && id !== null && id !== '') done.add(String(id));
        });
    }
    ensureDirForFile(getDoneFile());
    fs.writeFileSync(getDoneFile(), JSON.stringify([...done], null, 2), 'utf-8');
    return done.size;
}

function filterUndone(questions, doneIds) {
    const done = doneIds || loadDoneIds();
    return (Array.isArray(questions) ? questions : []).filter(q => !done.has(String(q && q.id)));
}

module.exports = {
    loadDoneIds,
    addDoneIds,
    filterUndone
};
