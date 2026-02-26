/**
 * Comprehensive list of motivational quotes, philosophies and wisdom
 * for IESA dashboard. Mix of engineering, academic, Nigerian, and universally
 * inspiring quotes.
 */

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  // ── Engineering & Technical ──
  { text: "The engineer has been, and is, a maker of history.", author: "James Kip Finch" },
  { text: "Scientists investigate that which already is; engineers create that which has never been.", author: "Albert Einstein" },
  { text: "Engineering is not merely knowing and being knowledgeable, like a walking encyclopedia; engineering is not merely analysis; engineering is not merely the possession of the capacity to get elegant solutions to non-existent engineering problems; engineering is practising the art of the organised forcing of technological change.", author: "Gordon Stanley Brown" },
  { text: "The ideal engineer is a composite. He is not a scientist, he is not a mathematician, he is not a sociologist or a writer; but he may use the knowledge and techniques of any or all of these disciplines in solving engineering problems.", author: "Nathan W. Dougherty" },
  { text: "Strive for perfection in everything you do. Take the best that exists and make it better.", author: "Henry Royce" },
  { text: "One man's 'magic' is another man's engineering.", author: "Robert A. Heinlein" },
  { text: "To the optimist, the glass is half full. To the pessimist, the glass is half empty. To the engineer, the glass is twice as big as it needs to be.", author: "Unknown" },
  { text: "The human foot is a masterpiece of engineering and a work of art.", author: "Leonardo da Vinci" },
  { text: "Manufacturing is more than just putting parts together. It's coming up with ideas, testing principles and perfecting the engineering.", author: "James Dyson" },
  { text: "Engineering problems are under-defined, there are many solutions, good, bad and indifferent. The art is to arrive at a good solution. This is a creative activity, involving imagination, intuition and deliberate choice.", author: "Ove Arup" },
  { text: "A good engineer thinks in reverse and asks himself about the stylistic consequences of the materials and methods he uses.", author: "Helmut Jahn" },
  { text: "At its heart, engineering is about using science to find creative, practical solutions. It is a noble profession.", author: "Queen Elizabeth II" },

  // ── Industrial Engineering Specific ──
  { text: "An operation that has no value should be eliminated.", author: "Taiichi Ohno" },
  { text: "Where there is no standard, there can be no improvement.", author: "Taiichi Ohno" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "In God we trust; all others must bring data.", author: "W. Edwards Deming" },
  { text: "It is not enough to do your best; you must know what to do, and then do your best.", author: "W. Edwards Deming" },
  { text: "A bad system will beat a good person every time.", author: "W. Edwards Deming" },
  { text: "The key is not to prioritise what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Plans are nothing; planning is everything.", author: "Dwight D. Eisenhower" },
  { text: "Reduce your plan to writing. The moment you complete this, you will have definitely given concrete form to the intangible desire.", author: "Napoleon Hill" },
  { text: "The first rule of any technology used in a business is that automation applied to an efficient operation will magnify the efficiency.", author: "Bill Gates" },
  { text: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" },
  { text: "The essence of strategy is choosing what not to do.", author: "Michael Porter" },
  { text: "If you can't describe what you are doing as a process, you don't know what you're doing.", author: "W. Edwards Deming" },

  // ── Academic & Learning ──
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "I am still learning.", author: "Michelangelo (at 87 years old)" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
  { text: "Tell me and I forget, teach me and I may remember, involve me and I learn.", author: "Benjamin Franklin" },
  { text: "The only person who is educated is the one who has learned how to learn and change.", author: "Carl Rogers" },
  { text: "It is the mark of an educated mind to be able to entertain a thought without accepting it.", author: "Aristotle" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Anyone who stops learning is old, whether at twenty or eighty.", author: "Henry Ford" },
  { text: "I have no special talents. I am only passionately curious.", author: "Albert Einstein" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },

  // ── Perseverance & Discipline ──
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "Confucius" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "A river cuts through rock, not because of its power, but because of its persistence.", author: "Jim Watkins" },

  // ── Nigerian Proverbs & Wisdom ──
  { text: "However far a stream flows, it never forgets its origin.", author: "Nigerian Proverb" },
  { text: "A single tree does not make a forest.", author: "Nigerian Proverb" },
  { text: "When the moon is shining, the cripple becomes hungry for a walk.", author: "Nigerian Proverb" },
  { text: "The child who is not embraced by the village will burn it down to feel its warmth.", author: "African Proverb" },
  { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb" },
  { text: "No matter how hot your anger is, it cannot cook yam.", author: "Nigerian Proverb" },
  { text: "The lizard that jumped from the high iroko tree to the ground said he would praise himself if no one else did.", author: "Chinua Achebe" },
  { text: "When one door closes, another one opens. But we often look so long at the closed door that we don't see the one that has opened for us.", author: "Nigerian Proverb" },
  { text: "Hold a true friend with both your hands.", author: "Nigerian Proverb" },
  { text: "He who asks questions cannot avoid the answers.", author: "Nigerian Proverb" },
  { text: "A wise person will always find a way.", author: "Tanzanian Proverb" },
  { text: "Tomorrow belongs to people who prepare for it today.", author: "African Proverb" },
  { text: "Knowledge without wisdom is like water in the sand.", author: "Guinean Proverb" },
  { text: "The one who plants trees, knowing that he will never sit in their shade, has at least started to understand the meaning of life.", author: "Rabindranath Tagore" },
  { text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.", author: "James Baldwin" },

  // ── Innovation & Creativity ──
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Creativity is thinking up new things. Innovation is doing new things.", author: "Theodore Levitt" },
  { text: "The people who are crazy enough to think they can change the world are the ones who do.", author: "Steve Jobs" },
  { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "If you can dream it, you can do it.", author: "Walt Disney" },
  { text: "Don't let what you cannot do interfere with what you can do.", author: "John Wooden" },
  { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "Think left and think right and think low and think high. Oh, the thinks you can think up if only you try!", author: "Dr. Seuss" },
  { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou" },

  // ── Leadership & Character ──
  { text: "Leadership is not about being in charge. It's about taking care of those in your charge.", author: "Simon Sinek" },
  { text: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader" },
  { text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch" },
  { text: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "Integrity is doing the right thing, even when no one is watching.", author: "C.S. Lewis" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "The greatest leader is not the one who does the greatest things, but the one who gets people to do the greatest things.", author: "Ronald Reagan" },
  { text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker" },
  { text: "You must be the change you wish to see in the world.", author: "Mahatma Gandhi" },

  // ── Career & Professional Growth ──
  { text: "Choose a job you love, and you will never have to work a day in your life.", author: "Confucius" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "The only way to discover the limits of the possible is to go beyond them into the impossible.", author: "Arthur C. Clarke" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Your education is a dress rehearsal for a life that is yours to lead.", author: "Nora Ephron" },
  { text: "The purpose of life is not to be happy. It is to be useful, to be honourable, to be compassionate, to have it make some difference that you have lived.", author: "Ralph Waldo Emerson" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },

  // ── Community & Teamwork ──
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { text: "Coming together is a beginning, staying together is progress, and working together is success.", author: "Henry Ford" },
  { text: "None of us is as smart as all of us.", author: "Ken Blanchard" },
  { text: "Talent wins games, but teamwork and intelligence win championships.", author: "Michael Jordan" },
  { text: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs" },
  { text: "United we stand, divided we fall.", author: "Aesop" },
  { text: "No one can whistle a symphony. It takes a whole orchestra to play it.", author: "H.E. Luccock" },

  // ── Mindset & Philosophy ──
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "We cannot solve our problems with the same thinking we used when we created them.", author: "Albert Einstein" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Your only limitation is the one you set up in your own mind.", author: "Napoleon Hill" },
  { text: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.", author: "Roy T. Bennett" },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { text: "You are never too old to set a new goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "The greatest wealth is to live content with little.", author: "Plato" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
];

/**
 * Get a deterministic "quote of the day" based on the current date.
 * Changes every day at midnight, same for all users on the same day.
 */
export function getQuoteOfTheDay(): Quote {
  const now = new Date();
  const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return QUOTES[daysSinceEpoch % QUOTES.length];
}

/**
 * Get a random quote (different on every call).
 */
export function getRandomQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
