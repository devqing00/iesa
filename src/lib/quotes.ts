/**
 * Comprehensive list of motivational quotes, philosophies and wisdom
 * for IESA dashboard. Mix of engineering, academic, Nigerian, and universally
 * inspiring quotes.
 */

export interface Quote {
  text: string;
  author: string;
  category?: "Motivation" | "Academic" | "Did You Know" | "Joke" | "Proverb";
}

export const QUOTES: Quote[] = [
  // ── Did You Know? Engineering & Industrial Facts ──
  { text: "Industrial Engineering originated in the 1880s with Frederick Winslow Taylor's pioneer time and motion studies at Midvale Steel.", author: "Historical Fact", category: "Did You Know" },
  { text: "Ergonomics (Human Factors) became a formal engineering discipline during WWII when cockpit design mismatches caused pilot crashes.", author: "Historical Fact", category: "Did You Know" },
  { text: "The Toyota Production System (TPS), which birthed Lean Manufacturing, was inspired by American supermarket inventory restocking systems.", author: "Engineering Fact", category: "Did You Know" },
  { text: "Operations Research (OR) algorithms were first developed during WWII to optimize radar station placement and convoy routing.", author: "OR Fact", category: "Did You Know" },
  { text: "Henry Ford's moving assembly line in 1913 reduced the time to build a Model T chassis from 12.5 hours to just 93 minutes.", author: "Manufacturing Fact", category: "Did You Know" },
  { text: "Six Sigma was created at Motorola by engineer Bill Smith in 1986 to target fewer than 3.4 defects per million opportunities.", author: "Quality Fact", category: "Did You Know" },
  { text: "The University of Ibadan Department of Industrial & Production Engineering is among Nigeria's premier engineering faculties.", author: "UI IPE Fact", category: "Did You Know" },
  { text: "Just-In-Time (JIT) manufacturing aims for zero inventory holding costs by delivering raw materials exactly when production begins.", author: "Lean Fact", category: "Did You Know" },
  { text: "The Simplex Algorithm, invented by George Dantzig in 1947, is the cornerstone technique used worldwide for linear programming.", author: "Optimization Fact", category: "Did You Know" },
  { text: "Kaizen is a Japanese philosophy meaning 'change for better' or 'continuous incremental improvement'.", author: "Lean Principle", category: "Did You Know" },
  { text: "The Pareto Principle (80/20 Rule) states that 80% of process outputs or defects often stem from 20% of the root causes.", author: "Quality Principle", category: "Did You Know" },

  // ── Lighthearted Engineering & Academic Jokes ──
  { text: "Why do engineers confuse Halloween and Christmas? Because Oct 31 == Dec 25!", author: "Engineering Humor", category: "Joke" },
  { text: "There are 10 types of people in the world: those who understand binary, and those who don't.", author: "Tech Humor", category: "Joke" },
  { text: "An optimist sees the glass half full. A pessimist sees it half empty. An Industrial Engineer sees it twice as big as necessary!", author: "IPE Joke", category: "Joke" },
  { text: "To the engineer, the glass is twice as big as it needs to be — so let's optimize the container design!", author: "Optimization Joke", category: "Joke" },
  { text: "What is an engineer's favorite type of tea? Quality!", author: "Quality Humor", category: "Joke" },

  // ── Engineering & Technical ──
  { text: "Scientists investigate that which already is; engineers create that which has never been.", author: "Albert Einstein", category: "Academic" },
  { text: "Strive for perfection in everything you do. Take the best that exists and make it better.", author: "Henry Royce", category: "Motivation" },
  { text: "One man's 'magic' is another man's engineering.", author: "Robert A. Heinlein", category: "Academic" },
  { text: "Manufacturing is more than putting parts together — it's perfecting ideas and processes.", author: "James Dyson", category: "Motivation" },

  // ── Industrial Engineering Specific ──
  { text: "An operation that has no value should be eliminated.", author: "Taiichi Ohno", category: "Academic" },
  { text: "Where there is no standard, there can be no improvement.", author: "Taiichi Ohno", category: "Academic" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle", category: "Motivation" },
  { text: "In God we trust; all others must bring data.", author: "W. Edwards Deming", category: "Academic" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker", category: "Motivation" },
  { text: "What gets measured gets managed.", author: "Peter Drucker", category: "Academic" },
  { text: "Continuous improvement is better than delayed perfection.", author: "Mark Twain", category: "Motivation" },

  // ── Academic & Learning ──
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela", category: "Academic" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King", category: "Motivation" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", category: "Academic" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes", category: "Motivation" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi", category: "Academic" },
  { text: "Study hard what interests you the most in the most original manner possible.", author: "Richard Feynman", category: "Academic" },

  // ── Nigerian Proverbs & Wisdom ──
  { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb", category: "Proverb" },
  { text: "No matter how far a stream flows, it never forgets its origin.", author: "Nigerian Proverb", category: "Proverb" },
  { text: "Tomorrow belongs to people who prepare for it today.", author: "African Proverb", category: "Proverb" },
  { text: "He who asks questions cannot avoid the answers.", author: "Nigerian Proverb", category: "Proverb" },

  // ── Perseverance & Mindset ──
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", category: "Motivation" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela", category: "Motivation" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke", category: "Motivation" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", category: "Motivation" },
];

/**
 * Get a deterministic "quote of the day" based on the current date.
 */
export function getQuoteOfTheDay(): Quote {
  const now = new Date();
  const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return QUOTES[daysSinceEpoch % QUOTES.length];
}

/**
 * Get a minute-based rotating quote/fact (changes every minute).
 */
export function getMinuteRotatingQuote(): Quote {
  const now = new Date();
  const minutesSinceEpoch = Math.floor(now.getTime() / (1000 * 60));
  return QUOTES[minutesSinceEpoch % QUOTES.length];
}

/**
 * Get a random quote (different on every call).
 */
export function getRandomQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
