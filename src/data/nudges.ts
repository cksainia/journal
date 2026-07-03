/**
 * Daily Nudge seed bank (spec §4.2D): 150+ micro-prompts shipped locally so the
 * nudge mode NEVER depends on AI. One rotates in per day, deterministically
 * from the dateKey. Claude may refresh/extend the bank in a later phase via
 * prompt_bank — this local list is the permanent fallback.
 */
export const NUDGES: string[] = [
  // Gratitude & kindness
  'What are you grateful for today?',
  "What's something kind you did (or saw someone do) today?",
  'Who made you smile today? What did they do?',
  'What is one thing you would say thank you for, if it could hear you?',
  'What made today better than it could have been?',
  'Who did you help today — or who helped you?',
  'What is something small that made you happy today?',
  'If you could give someone a prize today, who gets it and why?',
  'What is one thing about your family you are glad about?',
  'What would you like to thank YOURSELF for today?',
  // Laughs & jokes
  'Tell me a joke you heard — or make one up!',
  'What made you laugh today?',
  'What is the silliest thing you saw this week?',
  'If your pet (real or imaginary) could talk, what would it complain about?',
  'What is the funniest word you know? Why is it funny?',
  'Describe the weirdest sandwich anyone could ever make.',
  'What would be the WORST superpower to have? Why?',
  'If animals had jobs, what job would a squirrel have?',
  'What is something grown-ups do that makes no sense to you?',
  'Invent a brand-new holiday. What do people do on it?',
  // Books & reading
  'Tell me about the book you are reading!',
  'Which book character would you invite to dinner? Why?',
  'If you could jump into any book, which one — and what happens?',
  'What book do you think EVERYONE should read?',
  'Which book character is most like you?',
  'What would the villain from your favorite book order for lunch?',
  'If you wrote a book, what would it be called?',
  'What is the best book cover you have ever seen? Describe it.',
  'Which two book characters should meet each other? What happens?',
  'What book made you feel a big feeling? Which feeling?',
  // Memory & moments
  'Describe your day in exactly 3 words. Then explain them!',
  'What is one tiny moment from today you want to remember?',
  'What did you eat today that was delicious (or NOT delicious)?',
  'What sound do you remember hearing today?',
  'What was the best five minutes of your day?',
  'If today were a color, what color would it be? Why?',
  'What is something you saw today that you never noticed before?',
  'If you could replay one part of today, which part?',
  'What was the trickiest part of today?',
  'If today had a title like a book chapter, what would it be?',
  // Imagination & stories
  'You find a tiny door in your wall. Where does it lead?',
  'Your shoes can suddenly talk. What is the first thing they say?',
  'Invent a new ice cream flavor. Describe it so I can taste it!',
  'You wake up 10 feet tall. What do you do first?',
  'A dragon moves in next door. What is it like as a neighbor?',
  'Design your dream treehouse. What is inside?',
  'You can breathe underwater for one day. Where do you go?',
  'What would you do with a robot helper for one afternoon?',
  'You find a bottle with a message inside. What does it say?',
  'If your bedroom could magically add one thing, what would it be?',
  // Fantasy & mythology
  'If you had a magic power for ONE hour, what would you do?',
  'Invent a mythical creature. What does it look like? What does it eat?',
  'You get a quest from a wizard. What is the quest?',
  'Which mythical creature would make the best pet? The worst?',
  'You find a glowing gem on the sidewalk. What does it do?',
  'If you could visit any magical world, which one and why?',
  'Write a spell (and what it does) — make up the magic words!',
  'A phoenix lands on your window. What message does it bring?',
  'What would your superhero name and costume be?',
  'You are given a map with an X on it. What is buried there?',
  // Math & puzzles (bridging her strengths)
  'Explain how you would teach a little kid to add big numbers.',
  'What is your favorite number? What makes it the best?',
  'Invent a math problem about your day and solve it!',
  'How would you explain what zero means to an alien?',
  'If you counted everything you touched today, what number would you reach?',
  'What is the biggest number you can describe without just saying digits?',
  'Design a puzzle for someone in your family. What is the answer?',
  'What pattern did you notice today — anywhere?',
  'If your day were a graph, what would it look like? What goes up and down?',
  'Would you rather have 100 pennies or 4 quarters? Convince me!',
  // Nature & outdoors
  'What did the sky look like today?',
  'If you could talk to one animal today, which one? What would you ask?',
  'Describe the perfect puddle. What makes a puddle great?',
  'What is your favorite season? Sell it to me like an ad!',
  'What would it be like to be a bird for one day?',
  'What is the best climbing tree like?',
  'If you planted a magic seed, what would grow?',
  'What weather matches your mood today?',
  'Describe something in nature that is smaller than your hand.',
  'Where is your favorite outside place? What do you do there?',
  // Food
  'What is the best snack ever invented? Defend your answer!',
  'If you opened a restaurant, what would you serve?',
  'Describe your perfect breakfast — go big!',
  'What food do you NOT understand why people like?',
  'Invent a pizza topping nobody has tried. Would it work?',
  'If vegetables could talk, which one would be the bossiest?',
  'What is your favorite thing to cook or bake? What are the steps?',
  'You can only eat one color of food for a day. Which color wins?',
  'What smells better than it tastes? What tastes better than it smells?',
  'Plan the menu for a dragon dinner party.',
  // Friends & family
  'What is something funny someone in your family always says?',
  'Describe your friend to someone who has never met them.',
  'What game do you love playing with other people?',
  'Who in your family is most like a cartoon character? Which one?',
  'What is a tradition your family has that you love?',
  'If you could plan a perfect day with a friend, what happens?',
  'What did someone teach you recently?',
  'What would your family win a trophy for?',
  'Who do you miss? What would you tell them right now?',
  'What makes someone a REALLY good friend?',
  // Feelings & self
  'What are you really good at? How did you get good at it?',
  'What is something brave you did — even a little brave?',
  'What always cheers you up when you are grumpy?',
  'What are you looking forward to? Why?',
  'If your mood today were an animal, which animal?',
  'What is something new you tried recently? How did it go?',
  'What do you want to be amazing at by next summer?',
  'What is a rule YOU would make if you were in charge?',
  'What was hard today that might be easier tomorrow?',
  'Write a tiny letter to yourself from one year in the future.',
  // Would you rather
  'Would you rather fly or be invisible? What would you do first?',
  'Would you rather live in a castle or on a spaceship?',
  'Would you rather have a pet dinosaur or a pet dragon?',
  'Would you rather it always be summer or always be snowing?',
  'Would you rather talk to animals or speak every language?',
  'Would you rather be super fast or super strong?',
  'Would you rather explore the deep sea or outer space?',
  'Would you rather never do homework or never do chores? (Pick carefully!)',
  'Would you rather shrink to mouse-size or grow to giraffe-size for a day?',
  'Would you rather have a treehouse or a secret underground room?',
  // Senses & description
  'Close your eyes and listen. What do you hear right now?',
  'Describe your favorite cozy spot so I can picture it perfectly.',
  'What is the softest thing you touched today?',
  'Describe a color to someone who cannot see it.',
  'What does your home smell like when something yummy is cooking?',
  'Describe the most beautiful thing you saw this week.',
  'What texture do you love? What texture makes you go "ew"?',
  'Describe the sound of rain without using the word "rain."',
  'What is the brightest thing you can think of?',
  'Pick an object near you and describe it like it is treasure.',
  // Mini adventures & plans
  'You get one free trip anywhere tomorrow. Where are you going?',
  'Plan the perfect Saturday from wake-up to bedtime.',
  'If you could build anything in your backyard, what would it be?',
  'You are the teacher tomorrow. What do you teach?',
  'What would you put in a time capsule to open in 10 years?',
  'You can add one room to your house. What is in it?',
  'If you ran a store, what would it sell?',
  'What would you do with a whole day of NO rules?',
  'You get to name a new star in the sky. What do you name it and why?',
  'Invent a secret handshake. Describe every step!',
  // Quick sparks
  'What is your favorite word today? Use it in a silly sentence.',
  'Draw a picture with words: describe something without naming it.',
  'What is one question you wish you knew the answer to?',
  'If your toys came alive tonight, what would they do?',
  'What made you go "WOW" recently?',
  'Tell me about something tiny that is actually amazing.',
  'What would you say to a kid starting 3rd grade?',
  'If you could trade places with anyone for a day, who?',
  'What is the best thing about being 9?',
  'Make up a brand-new word and tell me what it means!',
]

/** Rotating bonus questions for the check-in (yes/no + optional detail). */
export const BONUS_QUESTIONS: string[] = [
  'Did anything surprise you today?',
  'Did you learn a new word today?',
  'Did you make something today?',
  'Did you go somewhere new today?',
  'Did anything make you laugh really hard today?',
  'Did you see something beautiful today?',
  'Did you try something for the first time today?',
]

/** Deterministic small hash so the same day always gets the same pick. */
function hashKey(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}

export function nudgeForDate(dateKey: string): string {
  return NUDGES[hashKey(dateKey) % NUDGES.length]
}

export function bonusQuestionForDate(dateKey: string): string {
  return BONUS_QUESTIONS[hashKey(dateKey) % BONUS_QUESTIONS.length]
}
