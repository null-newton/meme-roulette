// Base deck: original captions written for Meme Roulette. f = Family, s = Standard, x = Spicy (18+).
const RAW = `
f|When the group chat goes silent right after your joke
f|Me pretending I read the terms and conditions
f|My face when someone says "quick question"
f|When the Wi-Fi drops for two seconds
f|Me at 3 AM remembering something I said in 2014
f|When you hear your name in a conversation you're not part of
f|When the teacher says "find a partner"
f|Me explaining my 47-step morning routine
f|When you did the whole group project alone
f|Opening the fridge for the fifth time hoping something new appeared
f|Me watching the microwave count down the last 10 seconds
f|When someone says "we need to talk"
f|When the plans get cancelled and you were secretly hoping they would
f|That one friend who's always "five minutes away"
f|When you wave back at someone who wasn't waving at you
f|Me trying to look busy when the boss walks by
f|When autocorrect betrays you in front of everyone
f|When you suddenly remember you left the oven on
f|When your battery hits 1% and you're still 20 minutes from home
f|Me after one single push-up
f|When you say "I'm fine" but you are absolutely not fine
f|When the waiter says "enjoy your meal" and you say "you too"
f|When you've been on hold for 45 minutes and the music changes
f|Me pretending to understand the plot of the movie
f|When you step on a LEGO at 2 AM
f|When the dentist asks you a question with both hands in your mouth
f|Me walking into a room and forgetting why
f|When the parking spot is exactly where you wanted it
f|When someone eats the leftovers you were dreaming about all day
f|The face of someone who just got the last slice of pizza
f|When you see the price tag
f|When the Monday alarm goes off
f|Me on Friday at 4:59 PM
f|When your mom finds the "hidden" snacks
f|When you open the front camera by accident
f|When it's 11:58 and the breakfast menu ends at noon
f|Pretending you didn't see your teacher at the supermarket
f|When someone spoils the ending
f|When the self-checkout says "unexpected item in bagging area"
f|My last brain cell trying to keep things together
f|When the plot twist hits harder than expected
f|When you finally take off your shoes after a long day
f|When the delivery tracker says "out for delivery" at 7 AM
f|Me guarding the last cookie
f|When you sneeze and nobody says bless you
f|When you get the joke three hours later
f|When you finally find the remote
f|Me telling myself I'll only watch one episode
f|When the movie is "based on a true story" but nothing in it happened
f|Me after cleaning my room for ten minutes
f|When you make eye contact with someone through the bus window
f|When you laugh at your own joke before finishing it
f|Me when someone says "no offense, but…"
f|When you're the only one who brought a gift
f|When the GPS says "recalculating" for the third time
f|When the cat knocks something off the table and stares at you
f|Me at the family reunion when they ask about my "plans"
f|When you finally understand the math homework, the night after the test
f|When your phone autocorrects "on my way" to "on my wax"
f|When someone uses the wrong "your"
f|When the ice cream falls off the cone
f|The calm before the toddler storm
f|When you nail the parallel parking on the first try
f|Me waiting for the right moment to leave the party
f|When your sibling gets away with something you'd be grounded for
f|When the song you skipped comes back on shuffle
f|When you fall asleep on the couch and wake up in a different decade
f|When you try to be quiet and drop literally everything
f|Me reading the group chat without replying
f|When you accidentally like a photo from 2016
f|When someone asks "did you get my email?"
f|Me acting surprised at my own surprise party
f|When you hear the ice cream truck
f|Me running late but stopping to pet a dog
f|When you show up in the same outfit as someone else
f|When you realise it's only Tuesday
f|When the "five minute" walk takes 40 minutes
f|When the haircut doesn't look like the picture
f|When the waiter brings the food to the table next to you
f|When you hit snooze for the seventh time
f|Me explaining to my plants why they need to stop dying
f|When you're in the photo but you weren't ready
f|When you trip and pretend it was a dance move
f|When the bus driver waits for you
f|When you remember the answer the moment you hand in the test
f|When the soup is still lava after 10 minutes
f|When grandma says "you look thin" and keeps feeding you
f|When you realise the shop closed 5 minutes ago
f|When you find money in your old coat pocket
f|When the dog hears the treat bag from three rooms away
f|Me seeing a spider and moving out of the house
f|When you agree with someone just to end the conversation
f|When the vending machine keeps your snack
f|Me debating whether to go back for the thing I forgot
f|When you get a notification and it's just the weather
f|When you pull the push door in front of everyone
f|When your favourite show gets cancelled on a cliffhanger
f|Me when the teacher says "this will be on the test"
f|When your friend says "trust me, I know a shortcut"
f|When the online game says "just one more match"
f|When the kids are finally asleep
f|When you see your crush and forget how walking works
f|Me trying to fold a fitted sheet
f|When the Zoom call should have been an email
f|When you see someone who also has the same rare sneakers
f|When you finally beat the level you've been stuck on for a week
f|When it starts raining right after you wash your car
f|When you think it's Friday but it's Thursday
f|Me pretending to know about wine
f|When you taste the food you've been smelling all day
f|When your mom calls you by your full name
f|When the barista spells your name with a creative twist
f|When someone sits in your usual seat
f|When your uncle starts talking about crypto
f|When you get to the front of the queue and forget your order
f|My reaction to my own baby photos
f|When you put in zero effort and still win
f|When you wake up before the alarm and it's a Saturday
f|When the music festival lineup drops
f|Me watching someone else assemble IKEA furniture
f|When your dad tells the same joke for the 400th time
f|When the hotel breakfast is included
f|When you accidentally send the screenshot to the person in the screenshot
f|When you can't remember if you locked the door
f|When the test has questions from the one chapter you skipped
f|When someone claps when the plane lands
f|When you've been pronouncing a word wrong your whole life
f|When the fire alarm goes off while you're cooking toast
f|My face holding in a laugh at a serious moment
f|When it's your turn to pick the movie
f|When the kid at the next table won't stop staring
f|When you order the same thing every time and they change the menu
f|When someone says "it's not a big deal" and it's a big deal
f|When your package arrives earlier than expected
f|When you take a nap and wake up with no idea what year it is
f|Me pretending I'm not hungry while my friend eats
f|When your phone dies right before the best part of the story
f|When you open the snack bag and it's 80% air
f|When the "easy" puzzle has 2,000 pieces
f|Me realising I've been on mute the whole time
f|When the class gets cancelled
f|When the cashier says "have a nice day" and you say "you too" on autopilot
f|When you finally get the jar open
f|When you see the bill for the group dinner split evenly
f|When you find the perfect meme but can't remember who to send it to
f|When the pet looks guilty and you don't know why yet
f|Me trying to act natural in a family photo
f|When someone says "smile!" and you forget how
f|When your phone gets a new update and moves every button
f|When the queue next to you moves faster
f|When you tell a story and nobody reacts
f|When you're trying to sleep and your brain starts a podcast
f|Me pretending to be on my phone so I don't have to talk
f|When your drawing turns out exactly like you imagined
f|When the car in front of you drives 20 below the limit
f|Me guarding my fries from seagulls
f|When you hear a noise downstairs at night
f|When you're the designated driver and everyone's singing
f|When someone says "I don't watch TV" at the party
f|When the meeting starts with "this will be quick"
f|When you get a text that just says "hey"
f|When you finish a book and don't know what to do with your life
f|When it's been 0 days since your last bad idea
f|When the dog thinks it's a lap dog
f|Me after I finally clean out my inbox
f|When your best friend gets a new best friend
f|When you're too lazy to get up and turn off the light
f|When you remember you have leftovers
f|When the teacher picks you after you didn't raise your hand
f|Me trying to look cool while waiting for the bus
f|When you realise you've been singing the wrong lyrics for years
f|When the restaurant has a 40-page menu
f|When you get the window seat
f|When the baby finally stops crying on the plane
f|Me checking the oven every 30 seconds
f|When you've had one coffee and feel invincible
f|When you've had four coffees and can see sounds
f|When you finally say the right comeback, alone, in the shower
f|When someone takes the last parking space you were signalling for
f|When the store has your size
f|When you lose a sock in the washing machine dimension
f|When your friend shows you 47 photos of their holiday
f|When someone touches your stuff without asking
f|Me tiptoeing past my sleeping cat
f|Main character energy
f|Side character who knows way too much
f|Final boss of the family barbecue
f|The villain origin story starts here
f|Plot armor: activated
f|Tutorial level vs. the actual game
f|Expectation vs. reality
f|This is fine. Everything is fine.
f|Living my best life, technically
f|Professional overthinker, amateur everything else
f|Certified chaos coordinator
f|Not the hero we deserved, but the hero we got
f|Me in my head vs. me in real life
f|The vibe has been checked
f|Low battery, high spirits
f|Zero thoughts, head empty
f|Running on snacks and spite
f|Peak performance
f|The audacity
f|Born to nap, forced to work
f|Ah yes, the floor is made of floor
f|Achievement unlocked: leaving the house
f|Loading personality… please wait
f|404: motivation not found
f|Confidence of a cat walking past a cucumber
f|When you're the only one who read the instructions
f|Unexpectedly wholesome
f|Thanks, I hate it
f|Nobody: … Me:
f|The rare moment everything goes according to plan
f|One of us. One of us.
f|Just a normal Tuesday
f|Look at me. I'm the captain now.
f|Reply all strikes again
f|My toddler explaining the rules of a game he invented
f|When you realise you're the adult now
f|Trying to look innocent after eating the whole cake
f|Me on day 3 of my new healthy lifestyle
f|Can't stop. Won't stop. Should stop.
f|Instructions unclear, got stuck in the fridge
f|This photo is legally a documentary
f|Proof that we can't have nice things
f|The face of someone who just pressed "reply all"
f|Sir, this is a Wendy's
f|My plan was flawless. Then I started it.
f|When your hype man is louder than you
f|When you join a meeting and everyone's already laughing
f|Me waiting for the weekend like
f|When you meet the dog at the party
f|When the photo was supposed to be candid but took 40 tries
f|When you finally get the high score and nobody is watching
f|When your playlist starts with the perfect song
f|Me reading the instructions after breaking it
f|When it's your birthday and the waiters start singing
f|When the cat chooses your lap
f|When someone says "I'll keep it short"
f|Hold my juice box
s|When you wake up and remember everything you said last night
s|My bank account watching me order takeout again
s|Me pretending to work while my laptop does a software update
s|When the HR email starts with "per our policy"
s|When you see your ex with someone who looks exactly like you
s|My liver at the end of the holiday season
s|When the Uber says 2 minutes for 15 minutes
s|When you're three drinks in and decide to text "just checking in"
s|When the landlord says "small rent adjustment"
s|My face when the date says they don't like dogs
s|When rent is due and you just bought concert tickets
s|Me after "one quick drink" at 4 AM
s|When you check your screen time report
s|When the dating app match opens with "u up"
s|When your boss says "do you have a minute?" on Friday at 5
s|Me reading the email I sent with a typo in the subject line
s|When the barista calls your 9-shot coffee order out loud
s|When the group trip planner sends a 12-page spreadsheet
s|When someone takes credit for your idea in the meeting
s|When you realise you've been in the same hoodie for 4 days
s|When you see your old tweets
s|My face during the "fun" team-building exercise
s|When the tax return is bigger than expected
s|When you're overdressed for a casual party
s|When the hangover kicks in at the brunch you organised
s|When you swore you'd only spend €20
s|When they say "unlimited vacation" but nobody takes any
s|Me explaining to my therapist why it's actually everyone else
s|When you text the wrong group chat
s|When your ex likes your story at 2 AM
s|Me during the first 10 minutes of the work day
s|When you have six tabs of job applications open and close all of them
s|When your coworker microwaves fish
s|Me pretending to listen while thinking about lunch
s|When the "casual Friday" email arrives on a Thursday
s|When you realise the meeting is on camera
s|When you leave your phone at home and feel naked
s|My face at the gym, 11 minutes in
s|When the date says "I'm not like other people"
s|When the wedding has an open bar
s|When the wedding has a cash bar
s|When your friend says "we should do this more often" and you know you won't
s|When the guy at the party says "actually…"
s|When you walk into the party and don't know anyone
s|When your roommate's partner basically lives with you now
s|When someone replies "k"
s|When your mom joins Facebook
s|When you check your bank balance after the weekend
s|When you finally get a day off and the weather is terrible
s|When you hear "let's circle back" for the fourth time today
s|When the self-care is just staying in bed until 2 PM
s|When the cashier asks if you want to donate and the line is watching
s|Me pretending I'm saving money while ordering dessert
s|When you get a LinkedIn message from someone you went to school with
s|When you see a wedding announcement from someone younger than you
s|When your friend says "I'm not drinking tonight"
s|My face when someone says they wake up at 5 AM by choice
s|When the night is still young and you are not
s|Me making questionable decisions at the karaoke bar
s|When the playlist hits the throwbacks
s|When your parents ask you to fix the printer
s|When you get the bill for the "cheap" holiday
s|When you're the last one standing at the party
s|When the group chat is planning a trip that will never happen
s|Me trying to remember my password for the 9th time
s|When the meeting could've been a text
s|When you leave the gym and immediately buy a burger
s|When the dating profile says "6 feet" and they're clearly not
s|When the ex texts "I've changed"
s|When the plus-one turns into a plus-four
s|When someone puts pineapple on the pizza without asking
s|When your inbox has 4,000 unread emails and you make it 4,001
s|Me hiding from my responsibilities
s|When you show up to the party and the host is still in the shower
s|When your boss is on holiday
s|When you open your laptop on Monday and see 87 Slack messages
s|My personality is 80% inside jokes
s|When it's "mandatory fun" at work
s|When someone asks how the job hunt is going
s|When you realise your entire friend group is coupled up
s|When you're on a diet and someone brings donuts to work
s|When the bartender remembers your order
s|When you wake up still wearing yesterday's makeup
s|When your friend says "I'll be there in 5" from their bed
s|When the influencer says "this is not sponsored"
s|When the subscription renews before you cancel it
s|When your toxic trait is thinking you'll go to bed early
s|When the boss says we're "like a family"
s|Me after saying "I'm never drinking again"
s|When the cool aunt arrives at the family party
s|When you see a mirror after a night out
s|Emotionally I'm already in bed
s|Mentally I'm on a beach, physically I'm in this meeting
s|My toxic trait is believing this will work out
s|Somebody call HR
s|I'm not crying, you're crying
s|Not my circus. Definitely my monkeys.
s|Unpaid intern energy
s|This is what peak adulthood looks like
s|When the dog is better dressed than you
s|Brain: we should go to bed. Also brain: let's research medieval cheese.
s|Self-care is buying a plant and hoping it lives
s|Me at the office party after the second glass
s|When the pregame is better than the party
s|This is my "I've given up" face
s|The face of someone who just checked their crypto
s|Every family group chat ever
s|My credit score looking at this
s|I came for the snacks and stayed for the drama
s|Nobody asked, but here we are
s|Me pretending to be an adult in a home goods store
s|When the vacation photos look better than the vacation was
s|POV: you said yes to helping a friend move
s|Running entirely on caffeine and bad decisions
s|The hangover has entered the chat
s|When you swipe right on your cousin
s|When someone says "let's split it" and orders lobster
s|When you meet your partner's parents for the first time
s|When the ring light reveals too much
x|When you hear the neighbours "moving furniture" again at midnight
x|My face when the date suggests "Netflix and chill" on the first message
x|When you find out what your parents were doing on their "date night"
x|When you accidentally open the wrong browser tab during a screen share
x|When the walk of shame turns into a run of shame
x|When the dating app match is your coworker
x|When you realise the thin walls work both ways
x|Me after reading one chapter of that spicy book
x|When your mom asks why your phone has so many dating apps
x|When the morning after is also the afternoon after
x|When the honeymoon phase is very much over
x|When the tinder date looks nothing like their pictures
x|When you remember you said "I love you" at the club
x|When someone finds your search history
x|When they ask "what are we?" after two dates
x|When the hotel room walls are paper thin
x|When you wake up next to a decision
x|Dressed for the job I want: trophy spouse
x|When you send a risky text and immediately throw your phone
x|When you're at the bar and someone uses a pickup line from 2003
x|When the bachelorette party gets out of hand
x|When the "quick nap" with your partner is not a nap
x|When the stripper at the party is your old math teacher
x|When the body says yes but the back says no
x|When your friend brings their "situationship" to the party
x|When the bachelor party story is "classified"
x|Me deleting my history before lending my laptop
x|When the drunk text was meant for the ex but went to the boss
x|My face when someone says "I've never been kissed" at 30
x|When the hookup asks to stay for breakfast
x|When the ex is now dating your best friend
x|Thirst trap: deployed
x|When the confession at truth or dare goes too far
x|When you realise last night's "cute bartender" is your new manager
x|Me after accidentally liking my ex's new partner's photo
x|When your partner calls you by the wrong name
x|When the hangover comes with a new tattoo
x|When you see the bill for the champagne you insisted on
x|When the first date ends with "my place or yours?"
x|When the vibe was flirting but it was customer service
`;
export const CARDS = RAW.trim().split('\n').map(l => [l.slice(2), l[0]]);
