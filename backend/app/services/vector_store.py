"""
IESA AI Vector Store & Semantic Retrieval Engine (Self-Hosted Option 1)

Implements a 100% free, zero-cost Vector Space Engine using TF-IDF + N-gram Vectorization
and Cosine Similarity Search over official IESA Knowledgebase & Student Handbook passages.
"""

import math
import re
from typing import List, Dict, Any

# Stop words to filter out uninformative terms
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further",
    "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
    "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
    "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "will", "with", "you", "your", "yours", "yourself", "yourselves"
}

# Official IESA Knowledgebase Corpus (Passages for vector indexing)
CORPUS_DOCUMENTS = [
    {
        "id": "kb_overview",
        "title": "IESA Department & Executive Leadership Overview",
        "category": "leadership",
        "text": """Industrial Engineering Students' Association (IESA) represents all undergraduate students in the Department of Industrial and Production Engineering at the University of Ibadan (UI).
The executive team consists of the President, Vice President, General Secretary, Assistant General Secretary, Financial Secretary, Treasurer, Public Relations Officer (PRO), and Social Secretary.
Each level (100L, 200L, 300L, 400L, 500L) has elected Class Representatives (Class Reps) who manage course announcements, lecture venues, and timetable updates.
Departmental dues are compulsory annual payments that fund student welfare, academic resources, departmental events, and maintenance of student facilities."""
    },
    {
        "id": "kb_dues_payments",
        "title": "Departmental Dues, Fees & Payment Verification Policy",
        "category": "payments",
        "text": """All official departmental payments (Dues, Event Tickets, Merch, Workshops) are processed directly on the IESA Student Portal under Dashboard -> Payments.
Students can view their payment status (PAID or OWING) along with exact payment receipts and transaction reference IDs.
Payment statuses are categorized into PAID (completed), UNPAID (pending), URGENT (deadline approaching), and OVERDUE (deadline passed).
Bank transfer payments undergo manual review by the Financial Secretary/Treasurer before being verified. Once approved, official receipts can be generated directly from Dashboard -> Payments."""
    },
    {
        "id": "kb_iepod",
        "title": "IEPOD - Industrial Engineering Professional Development Incubator",
        "category": "iepod",
        "text": """IEPOD (Industrial Engineering Professional Development) is the department's flagship professional incubator designed to build career-ready engineering talent.
IEPOD operates 5 specialized tracks/societies: Tech & Software Engineering, Operations & Supply Chain, UI/UX & Product Design, Strategy & Product Management, and Data Analytics/AI.
Students register for IEPOD at the beginning of the academic session on Dashboard -> IEPOD.
The program runs in structured phases: Skill Foundations (Phase 1), Group Projects (Phase 2), Pitch Competition & Showcase (Phase 3), and Internship/Industry Placement (Phase 4).
100L to 500L students are eligible to join IEPOD societies to work on real-world projects and build portfolios."""
    },
    {
        "id": "kb_timp",
        "title": "TIMP - The Industrial Mentorship Program",
        "category": "timp",
        "text": """TIMP (The Industrial Mentorship Program) pairs junior students with senior peers and alumni mentors for academic and career guidance.
Application Flow: Only senior students (300L, 400L, 500L) and alumni apply to become Mentors.
100L and 200L students do NOT apply to be mentors. All 100L students are automatically placed in the Mentee pool and assigned to verified mentors by the TIMP Committee.
Mentors and Mentees track their pairing progress, meeting logs, and mentorship goals on Dashboard -> TIMP."""
    },
    {
        "id": "kb_growth_cgpa",
        "title": "Growth Hub, CGPA Rules & Academic Standing",
        "category": "academic",
        "text": """The IESA Growth Hub provides 8 digital productivity tools for students: CGPA Calculator, Focus Timer (Pomodoro), Daily Habits Tracker, Course Planner, Study Group Finder, Flashcards, Study Journal, and Goal Setter.
The University of Ibadan operates on a 5.0 Grading Scale: A (70-100% = 5 pts), B (60-69% = 4 pts), C (50-59% = 3 pts), D (45-49% = 2 pts), E (40-44% = 1 pt), F (0-39% = 0 pts).
First Class standing requires a CGPA of 4.50 - 5.00. Second Class Upper requires 3.50 - 4.49. Second Class Lower requires 2.40 - 3.49. Third Class requires 1.50 - 2.39.
Students with a CGPA below 1.50 at the end of a session are placed on Academic Probation.
400L Second Semester is designated for Industrial Training (IT / SIWES) where students spend 6 months gaining practical industrial work experience."""
    },
    {
        "id": "kb_timetable_library",
        "title": "Timetable, Course Materials & Resource Library",
        "category": "resources",
        "text": """Class timetables and exam schedules are updated dynamically by Class Representatives and admins under Dashboard -> Timetable.
Students can view daily lectures, venues, time slots, lecturer names, and cancellations.
The IESA Digital Library (Dashboard -> Resources) provides downloadable lecture slides, recommended textbook PDFs, past examination questions, and tutorial solutions filtered by student level (100L to 500L)."""
    },
    {
        "id": "kb_events_community",
        "title": "Departmental Events, Press & Community",
        "category": "community",
        "text": """IESA hosts annual flagship events including the IESA Dinner & Awards, Annual Engineering Conference, Freshers' Orientation, Sports Week, and Hackathons.
Students RSVP for events on Dashboard -> Events.
The IESA Press (Dashboard -> Press) publishes student journalism, tech articles, departmental news, editorial opinions, and event recaps.
Students can join study groups or search peer profiles on Dashboard -> Growth -> Study Groups."""
    }
]


class VectorStoreEngine:
    """
    In-memory TF-IDF & Cosine Similarity Vector Retrieval Engine.
    """

    def __init__(self, corpus: List[Dict[str, Any]]):
        self.corpus = corpus
        self.vocab: Dict[str, int] = {}
        self.doc_vectors: List[Dict[str, float]] = []
        self.idf: Dict[str, float] = {}
        self._build_vector_space()

    def _tokenize(self, text: str) -> List[str]:
        """Clean text and extract 1-grams and 2-grams."""
        text = text.lower()
        words = re.findall(r"\b[a-z0-9]+\b", text)
        words = [w for w in words if w not in STOP_WORDS and len(w) > 1]
        
        # Add 2-grams (bigrams) for phrase matching
        bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words) - 1)]
        return words + bigrams

    def _build_vector_space(self):
        """Build TF-IDF vocabulary and normalized document vectors."""
        num_docs = len(self.corpus)
        doc_freqs: Dict[str, int] = {}
        tf_list: List[Dict[str, float]] = []

        for doc in self.corpus:
            tokens = self._tokenize(f"{doc['title']} {doc['text']}")
            tf_dict: Dict[str, int] = {}
            for token in tokens:
                tf_dict[token] = tf_dict.get(token, 0) + 1
            
            # Sublinear TF scaling: 1 + log(tf)
            scaled_tf = {token: (1.0 + math.log(count)) for token, count in tf_dict.items()}
            tf_list.append(scaled_tf)

            for token in scaled_tf.keys():
                doc_freqs[token] = doc_freqs.get(token, 0) + 1

        # Compute IDF for each term: log(N / df)
        for term, df in doc_freqs.items():
            self.idf[term] = math.log((num_docs + 1.0) / (df + 0.5)) + 1.0

        # Build normalized TF-IDF vectors for documents
        for tf_dict in tf_list:
            vector: Dict[str, float] = {}
            squared_sum = 0.0
            for term, tf_val in tf_dict.items():
                val = tf_val * self.idf.get(term, 1.0)
                vector[term] = val
                squared_sum += val * val

            norm = math.sqrt(squared_sum) if squared_sum > 0 else 1.0
            # L2 Normalize vector
            norm_vector = {term: val / norm for term, val in vector.items()}
            self.doc_vectors.append(norm_vector)

    def search(self, query: str, top_k: int = 3, threshold: float = 0.10) -> List[Dict[str, Any]]:
        """
        Perform Cosine Similarity Search over vector space.
        Returns top_k matching document passages with similarity scores.
        """
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        # Build query TF-IDF vector
        q_tf: Dict[str, int] = {}
        for token in query_tokens:
            q_tf[token] = q_tf.get(token, 0) + 1

        q_vector: Dict[str, float] = {}
        squared_sum = 0.0
        for token, count in q_tf.items():
            if token in self.idf:
                val = (1.0 + math.log(count)) * self.idf[token]
                q_vector[token] = val
                squared_sum += val * val

        norm = math.sqrt(squared_sum) if squared_sum > 0 else 1.0
        q_norm_vector = {token: val / norm for token, val in q_vector.items()}

        # Compute Cosine Similarity against all document vectors
        results = []
        for idx, doc_vector in enumerate(self.doc_vectors):
            score = 0.0
            for token, q_val in q_norm_vector.items():
                if token in doc_vector:
                    score += q_val * doc_vector[token]

            if score >= threshold:
                doc = self.corpus[idx].copy()
                doc["score"] = round(score, 4)
                results.append(doc)

        # Sort by similarity score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


# Global Vector Store Singleton instance
vector_store = VectorStoreEngine(CORPUS_DOCUMENTS)
