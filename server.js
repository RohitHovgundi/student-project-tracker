
import express from 'express';
import { db } from './database.js';

const app = express();

app.use(express.static('public'));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

const validStatuses = ['Planned', 'In Progress', 'Completed'];

function validateProject(body) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const status = body?.status;

    if (name.length < 1 || name.length > 80) {
        return { error: 'Name must be between 1 and 80 characters.' };
    }

    if (!validStatuses.includes(status)) {
        return { error: 'Status must be Planned, In Progress, or Completed.' };
    }

    return { value: { name, status } };
}

app.get('/api/projects', async (req, res) => {
    res.json(await db.list());
});

app.post('/api/projects', async (req, res) => {
    const result = validateProject(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    try {
        const project = await db.create(result.value);
        res.status(201).json(project);
    } catch {
        res.status(400).json({ error: 'Could not create project.' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid project ID.' });
    }

    const result = validateProject(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    try {
        const project = await db.update(id, result.value);
        if (!project) return res.status(404).json({ error: 'Project not found.' });
        res.json(project);
    } catch {
        res.status(400).json({ error: 'Could not update project.' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid project ID.' });
    }

    const removed = await db.remove(id);
    if (!removed) return res.status(404).json({ error: 'Project not found.' });

    res.status(204).end();
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => console.log(`Open http://localhost:${port}`));
