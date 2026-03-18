from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class DuplicateResult:
    is_duplicate: bool
    original_id: Optional[int]
    similarity_score: float


class NewsDeduplicator:
    """TF-IDF + 코사인 유사도 기반 뉴스 중복 제거"""

    def __init__(self, threshold: float = 0.8):
        self.threshold = threshold
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words=None  # 한국어는 별도 처리 필요
        )

    def check_duplicate(
        self,
        new_text: str,
        existing_texts: List[str],
        existing_ids: List[int]
    ) -> DuplicateResult:
        """새 뉴스가 기존 뉴스와 중복인지 확인"""

        if not existing_texts:
            return DuplicateResult(
                is_duplicate=False,
                original_id=None,
                similarity_score=0.0
            )

        # 모든 텍스트를 한 번에 벡터화
        all_texts = existing_texts + [new_text]
        try:
            tfidf_matrix = self.vectorizer.fit_transform(all_texts)
        except ValueError:
            return DuplicateResult(
                is_duplicate=False,
                original_id=None,
                similarity_score=0.0
            )

        # 새 뉴스와 기존 뉴스들의 유사도 계산
        new_vector = tfidf_matrix[-1]
        existing_vectors = tfidf_matrix[:-1]

        similarities = cosine_similarity(new_vector, existing_vectors)[0]

        # 최대 유사도 확인
        max_idx = np.argmax(similarities)
        max_similarity = similarities[max_idx]

        if max_similarity >= self.threshold:
            return DuplicateResult(
                is_duplicate=True,
                original_id=existing_ids[max_idx],
                similarity_score=float(max_similarity)
            )

        return DuplicateResult(
            is_duplicate=False,
            original_id=None,
            similarity_score=float(max_similarity)
        )

    def batch_deduplicate(
        self,
        texts: List[str],
        ids: List[int]
    ) -> List[Tuple[int, int, float]]:
        """배치로 중복 뉴스 쌍 찾기"""

        if len(texts) < 2:
            return []

        tfidf_matrix = self.vectorizer.fit_transform(texts)
        similarity_matrix = cosine_similarity(tfidf_matrix)

        duplicates = []
        for i in range(len(texts)):
            for j in range(i + 1, len(texts)):
                if similarity_matrix[i][j] >= self.threshold:
                    duplicates.append((ids[i], ids[j], similarity_matrix[i][j]))

        return duplicates


def preprocess_text(title: str, content: str) -> str:
    """제목과 본문을 전처리하여 비교용 텍스트 생성"""
    # 제목에 가중치를 주기 위해 3번 반복
    combined = f"{title} {title} {title} {content}"

    # 기본 전처리
    combined = combined.lower()
    combined = " ".join(combined.split())  # 연속 공백 제거

    return combined
