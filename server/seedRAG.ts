// Seed sample knowledge base documents for RAG testing
const sampleDocs = [
    {
        namespace: 'launch-readiness',
        documents: [
            {
                text: 'Deployment health check: All systems nominal at 98.6% health. Last staging deployment passed with zero critical issues.',
                metadata: { source: 'health-monitor', timestamp: new Date().toISOString() }
            },
            {
                text: 'Sydney relay window: Known latency spikes occur during 2-6 AM UTC when traffic routes through Sydney. Recommended mitigation: reroute through west coast edge servers.',
                metadata: { source: 'incident-log', severity: 'medium' }
            },
            {
                text: 'Launch checklist: Pre-flight checks include telemetry verification, crew comms test, fuel mixture analysis (tolerance <1%), and backup system validation.',
                metadata: { source: 'operations-manual', section: 'launch-procedures' }
            }
        ]
    },
    {
        namespace: 'incident-digest',
        documents: [
            {
                text: 'Model drift detection: APAC segment showing 12% shift in conversational tone. Root cause: training data imbalance. Mitigation: retrain with regional samples.',
                metadata: { source: 'ml-ops', incident_id: 'INC-2847' }
            },
            {
                text: 'Vector cache eviction: Cache hit rate dropped 18% due to increased query diversity. Recommendation: expand cache size or implement smarter eviction policy.',
                metadata: { source: 'performance-monitoring', severity: 'high' }
            }
        ]
    },
    {
        namespace: 'research-scout',
        documents: [
            {
                text: 'Arxiv 2412.101: Multi-agent planning paper introduces hierarchical task decomposition for autonomous systems. Key insight: agents can negotiate subtask allocation dynamically.',
                metadata: { source: 'arxiv', paper_id: '2412.101', status: 'peer-review' }
            },
            {
                text: 'Competitor analysis: Nova One demo showcased real-time streaming with <200ms latency. Differentiator: integrated reasoning layer with memory persistence.',
                metadata: { source: 'competitive-intel', competitor: 'Nova One' }
            }
        ]
    }
];

async function seedRAG() {
    const baseURL = 'http://localhost:8787';

    for (const { namespace, documents } of sampleDocs) {
        try {
            const response = await fetch(`${baseURL}/api/rag/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ namespace, documents })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Seeded ${result.count} documents into "${namespace}" namespace`);
            } else {
                console.error(`❌ Failed to seed "${namespace}":`, await response.text());
            }
        } catch (error) {
            console.error(`❌ Error seeding "${namespace}":`, error);
        }
    }

    console.log('\n🎉 RAG knowledge base seeded! Try asking about:');
    console.log('  - "What\'s our deployment status?" (launch-readiness)');
    console.log('  - "Tell me about the model drift issue" (incident-digest)');
    console.log('  - "What did the multi-agent planning paper say?" (research-scout)');
}

seedRAG().catch(console.error);
