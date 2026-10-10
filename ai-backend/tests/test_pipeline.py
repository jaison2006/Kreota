from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    assert client.get('/health').json()['status'] == 'ok'

def test_extract_campaign():
    response = client.post('/api/campaign/extract', json={'description': 'Create a cinematic luxury perfume video for Instagram Reels, 15 seconds, 9:16 vertical, golden lighting.'})
    assert response.status_code == 200
    data = response.json()
    assert data['content_type'] == 'video'
    assert data['duration_seconds'] == 15
    assert data['aspect_ratio'] == '9:16'
    assert 'cinematic' in data['style_keywords']

def test_report_has_ranked_matches():
    response = client.post('/api/reports/generate', json={'description': 'Create a cinematic luxury perfume video for Instagram Reels, 15 seconds, 9:16 vertical, golden lighting.'})
    assert response.status_code == 200
    data = response.json()
    assert len(data['recommendations']) > 0
    assert data['recommendations'][0]['match_score'] >= data['recommendations'][-1]['match_score']

def test_prompt_generation():
    extracted = client.post('/api/campaign/extract', json={'description': 'Create a cinematic luxury perfume video, 15 seconds, 9:16 vertical.'}).json()
    response = client.post('/api/prompts/generate', json={'campaign': extracted, 'target_tool': 'higgsfield'})
    assert response.status_code == 200
    assert 'Higgsfield' in response.json()['prompt'] or 'Higgsfield' in response.json()['sections']['tool_guidance']
