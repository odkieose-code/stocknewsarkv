# Stock News - 주식 뉴스 큐레이션 서비스

주식 투자자를 위한 AI 기반 뉴스 큐레이션 웹 서비스

## 주요 기능

- 뉴스 크롤링 (네이버 증권, 연합인포맥스)
- 중복 뉴스 자동 제거 (TF-IDF + 코사인 유사도)
- AI 기반 분석 (수혜주/피해주, 감성 분석, 섹터 분류)
- 중요도 기반 뉴스 정렬
- 실시간 이슈 키워드

## 기술 스택

### Backend
- Python 3.11+
- FastAPI
- PostgreSQL
- SQLAlchemy (async)
- OpenAI / Claude API

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- TanStack Query

## 실행 방법

### 1. 환경 설정

```bash
# Backend
cd backend
cp .env.example .env
# .env 파일에 API 키 입력

# 가상환경 생성 및 패키지 설치
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

```bash
# Frontend
cd frontend
npm install
```

### 2. 데이터베이스 설정

PostgreSQL 설치 후:

```bash
createdb stocknews
```

### 3. 서버 실행

```bash
# Backend (터미널 1)
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend (터미널 2)
cd frontend
npm run dev
```

### 4. 접속

- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/news | 뉴스 목록 (중요도순) |
| GET | /api/news/:id | 뉴스 상세 |
| GET | /api/stocks/beneficiary | 오늘의 수혜주 |
| GET | /api/keywords/trending | 급상승 키워드 |
| GET | /api/sectors | 섹터별 뉴스 카운트 |

## 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| DATABASE_URL | PostgreSQL 연결 URL | postgresql+asyncpg://... |
| OPENAI_API_KEY | OpenAI API 키 | sk-... |
| ANTHROPIC_API_KEY | Claude API 키 | sk-ant-... |
| AI_PROVIDER | 사용할 AI | openai / anthropic |
