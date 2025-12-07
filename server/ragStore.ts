import * as lancedb from '@lancedb/lancedb';

export interface RAGDocument {
    id?: string;
    text: string;
    metadata?: Record<string, unknown>;
}

let dbPromise: Promise<lancedb.Connection> | null = null;

async function getDb() {
    if (!dbPromise) {
        dbPromise = lancedb.connect('data/lancedb');
    }
    return dbPromise;
}

export async function upsertDocuments(namespace: string, docs: RAGDocument[]) {
    if (!docs.length) return;
    const db = await getDb();
    const tableName = `kb_${namespace}`;
    const tableExists = (await db.tableNames()).includes(tableName);
    const table = tableExists
        ? await db.openTable(tableName)
        : await db.createTable(tableName, docs, { mode: 'overwrite' });

    if (tableExists) {
        await table.add(docs);
    }
}

export async function searchRelevantDocs(namespace: string, query: string, k = 5) {
    const db = await getDb();
    const tableName = `kb_${namespace}`;
    const tableExists = (await db.tableNames()).includes(tableName);
    if (!tableExists) return [] as RAGDocument[];
    
    try {
        const table = await db.openTable(tableName);
        // For now, return all docs from the namespace (no vector search yet)
        // TODO: Add embedding model + vector search when needed
        const results = await table.query().limit(k).toArray();
        return results as RAGDocument[];
    } catch (error) {
        console.warn(`[RAG] Error searching ${namespace}:`, error);
        return [] as RAGDocument[];
    }
}
