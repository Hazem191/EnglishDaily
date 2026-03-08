import json
import random

def generate_questions():
    questions = {}
    
    # 1. Grammar (20)
    grammar_data = [
        ("She ___ to the market every Saturday.", ["go", "goes", "going", "gone"], "goes"),
        ("I have been studying English ___ 2010.", ["since", "for", "during", "at"], "since"),
        ("If it rains, we ___ stay at home.", ["will", "would", "are", "shall"], "will"),
        ("___ you like a cup of tea?", ["Do", "Would", "Will", "Can"], "Would"),
        ("The book is ___ the table.", ["on", "in", "at", "under"], "on"),
        ("He is ___ than his brother.", ["tall", "taller", "tallest", "more tall"], "taller"),
        ("They ___ playing football now.", ["is", "are", "am", "be"], "are"),
        ("___ is your favorite color?", ["Who", "What", "Where", "When"], "What"),
        ("I ___ my homework yesterday.", ["do", "did", "done", "doing"], "did"),
        ("She doesn't ___ any sisters.", ["has", "have", "had", "having"], "have"),
        ("We ___ to London last year.", ["go", "went", "gone", "going"], "went"),
        ("This is ___ interesting movie.", ["a", "an", "the", "any"], "an"),
        ("You ___ smoke in the hospital.", ["mustn't", "don't", "can't", "won't"], "mustn't"),
        ("___ she speak Spanish?", ["Do", "Does", "Is", "Has"], "Does"),
        ("I'm looking forward to ___ you.", ["meet", "meeting", "met", "meets"], "meeting"),
        ("The cake was ___ by my mother.", ["make", "made", "making", "makes"], "made"),
        ("He succeeded ___ passing the exam.", ["in", "on", "at", "with"], "in"),
        ("That is the man ___ car was stolen.", ["who", "whom", "whose", "which"], "whose"),
        ("I don't think I ___ be able to come.", ["will", "shall", "can", "may"], "will"),
        ("Neither of the books ___ interesting.", ["is", "are", "be", "being"], "is")
    ]
    
    # 2. Vocabulary (20)
    vocab_data = [
        ("What is the synonym of 'Enormous'?", ["Small", "Huge", "Tiny", "Weak"], "Huge"),
        ("The opposite of 'Ancient' is ___.", ["Old", "Modern", "Classic", "History"], "Modern"),
        ("A person who designs buildings is an ___.", ["Artist", "Architect", "Engineer", "Doctor"], "Architect"),
        ("The word 'Fragile' means something that is ___.", ["Strong", "Easy to break", "Expensive", "Heavy"], "Easy to break"),
        ("What is the past tense of 'Catch'?", ["Cated", "Caught", "Catching", "Catched"], "Caught"),
        ("Which word means 'very tired'?", ["Exhausted", "Excited", "Happy", "Bored"], "Exhausted"),
        ("The capital city ___ France is Paris.", ["of", "in", "at", "to"], "of"),
        ("A large area of water surrounded by land is a ___.", ["Lake", "River", "Ocean", "Sea"], "Lake"),
        ("Which fruit is traditionally given to teachers?", ["Orange", "Banana", "Apple", "Grape"], "Apple"),
        ("What do you call a person from Germany?", ["Germanish", "German", "Germany", "Germane"], "German"),
        ("Which is a primary color?", ["Green", "Purple", "Red", "Orange"], "Red"),
        ("What is the opposite of 'Victory'?", ["Success", "Win", "Defeat", "Goal"], "Defeat"),
        ("A doctor who performs operations is a ___.", ["Surgeon", "Nurse", "Pharmacist", "Patient"], "Surgeon"),
        ("What is the collective noun for lions?", ["Pack", "Herd", "Pride", "Flock"], "Pride"),
        ("Which season comes after winter?", ["Autumn", "Summer", "Spring", "Fall"], "Spring"),
        ("The synonym of 'Quick' is ___.", ["Slow", "Fast", "Careful", "Quiet"], "Fast"),
        ("A place where you can borrow books is a ___.", ["Bookshop", "Library", "School", "Museum"], "Library"),
        ("What is a baby dog called?", ["Kitten", "Puppy", "Cub", "Lamb"], "Puppy"),
        ("Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Saturn"], "Mars"),
        ("The opposite of 'Generous' is ___.", ["Kind", "Mean", "Happy", "Rich"], "Mean")
    ]

    # 3. Sentence Ordering (20)
    ordering_data = [
        ("jumble: school / to / goes / he / everyday", "He goes to school everyday"),
        ("jumble: is / weather / today / how / the", "How is the weather today"),
        ("jumble: love / I / English / learning", "I love learning English"),
        ("jumble: cat / the / mat / on / sat / the", "The cat sat on the mat"),
        ("jumble: breakfast / you / have / did", "Did you have breakfast"),
        ("jumble: book / reading / is / she / a", "She is reading a book"),
        ("jumble: where / live / do / you", "Where do you live"),
        ("jumble: fast / car / the / is / very", "The car is very fast"),
        ("jumble: will / tomorrow / visit / we / you", "We will visit you tomorrow"),
        ("jumble: name / your / what / is", "What is your name"),
        ("jumble: many / how / siblings / have / you / do", "How many siblings do you have"),
        ("jumble: cake / delicious / this / is", "This cake is delicious"),
        ("jumble: soccer / they / park / the / in / play", "They play soccer in the park"),
        ("jumble: doctor / wants / he / to / be / a", "He wants to be a doctor"),
        ("jumble: time / what / is / it", "What time is it"),
        ("jumble: apple / an / a / day / keeps / doctor / the / away", "An apple a day keeps the doctor away"),
        ("jumble: music / listening / she / to / enjoys", "She enjoys listening to music"),
        ("jumble: movie / was / the / scary / very", "The movie was very scary"),
        ("jumble: phone / cell / is / my / where", "Where is my cell phone"),
        ("jumble: dinner / cooking / my / is / mother", "My mother is cooking dinner")
    ]

    # 4. Error Correction (20)
    error_data = [
        ("Fix the error: She don't like apples.", "She doesn't like apples"),
        ("Fix the error: I am having two brothers.", "I have two brothers"),
        ("Fix the error: He go to work by bus.", "He goes to work by bus"),
        ("Fix the error: Where you did go?", "Where did you go"),
        ("Fix the error: I more taller than him.", "I am taller than him"),
        ("Fix the error: They was playing in the garden.", "They were playing in the garden"),
        ("Fix the error: My friend live in Cairo.", "My friend lives in Cairo"),
        ("Fix the error: She is more prettier.", "She is prettier"),
        ("Fix the error: I can to swim.", "I can swim"),
        ("Fix the error: Have you see my keys?", "Have you seen my keys"),
        ("Fix the error: It's a hour long.", "It's an hour long"),
        ("Fix the error: He speak English good.", "He speaks English well"),
        ("Fix the error: I have 10 years old.", "I am 10 years old"),
        ("Fix the error: We was at the cinema.", "We were at the cinema"),
        ("Fix the error: Everybody are happy.", "Everybody is happy"),
        ("Fix the error: I am looking for a work.", "I am looking for a job"),
        ("Fix the error: She did not saw me.", "She did not see me"),
        ("Fix the error: Who's car is this?", "Whose car is this"),
        ("Fix the error: Please lend me a pen?", "Please lend me a pen"),
        ("Fix the error: I go every day to school.", "I go to school every day")
    ]

    # 5. Multiple Choice (20)
    mcq_data = [
        ("Which of these is a noun?", ["Run", "Happy", "Table", "Quickly"], "Table"),
        ("Which is a synonym for 'Sad'?", ["Joyful", "Unhappy", "Angry", "Calm"], "Unhappy"),
        ("Choose the correct spelling:", ["Receive", "Recieve", "Receve", "Reseive"], "Receive"),
        ("What is the plural of 'Foot'?", ["Foots", "Feet", "Feets", "Footes"], "Feet"),
        ("Which is an exclamation?", ["Stop!", "Where?", "I am.", "Hello."], "Stop!"),
        ("Choose the odd one out:", ["Banana", "Apple", "Carrot", "Mango"], "Carrot"),
        ("Which is a conjunction?", ["Wait", "And", "Blue", "Tall"], "And"),
        ("What is the plural of 'Child'?", ["Children", "Childs", "Childrens", "Childes"], "Children"),
        ("Which word is an adverb?", ["Slow", "Slowly", "Slower", "Slowest"], "Slowly"),
        ("Choose the correct article: ___ university.", ["a", "an", "the", "zero"], "a"),
        ("Which month has 28 or 29 days?", ["January", "February", "March", "April"], "February"),
        ("What do you call a person who makes bread?", ["Baker", "Butcher", "Tailor", "Chef"], "Baker"),
        ("Which is a question word?", ["Some", "Very", "How", "Then"], "How"),
        ("Which of these is a past tense?", ["Walk", "Walking", "Walked", "Walks"], "Walked"),
        ("Choose the synonym for 'Beautiful':", ["Ugly", "Gorgeous", "Plain", "Horrible"], "Gorgeous"),
        ("What is 'ASAP' short for?", ["As soon as possible", "Always say a prayer", "Apples stay at park", "All students are proud"], "As soon as possible"),
        ("Which is a preposition?", ["In", "Go", "Fast", "Wait"], "In"),
        ("What is the opposite of 'Top'?", ["Side", "Bottom", "Middle", "Near"], "Bottom"),
        ("Which is a pronoun?", ["They", "Think", "Town", "Total"], "They"),
        ("Choose the correct contraction for 'It is':", ["Its", "It's", "I'ts", "Its'"], "It's")
    ]

    category_data = {
        "grammar": grammar_data,
        "vocabulary": vocab_data,
        "sentence-ordering": ordering_data,
        "error-correction": error_data,
        "multiple-choice": mcq_data
    }

    count = 1
    for cat, data in category_data.items():
        for item in data:
            qid = f"q{count}"
            if cat in ["grammar", "vocabulary", "multiple-choice"]:
                questions[qid] = {
                    "questionText": item[0],
                    "type": cat,
                    "options": item[1],
                    "correctAnswer": item[2],
                    "createdAt": 1709653892000 + count
                }
            else:
                questions[qid] = {
                    "questionText": item[0],
                    "type": cat,
                    "correctAnswer": item[1],
                    "createdAt": 1709653892000 + count
                }
            count += 1
            
    return questions

# Base DB structure
db = {
    "users": {
        "admins": {
            "admin-1": {
                "id": "admin-1",
                "name": "Admin Teacher",
                "email": "teacher@test.com",
                "password": "Password123",
                "role": "teacher"
            }
        },
        "students": {
            "u-demo-1": {
                "id": "u-demo-1",
                "name": "English Learner",
                "email": "student@test.com",
                "password": "Password123",
                "role": "student",
                "totalScore": 0
            }
        }
    },
    "questions": generate_questions(),
    "dailyResults": {}
}

with open('db.json', 'w') as f:
    json.dump(db, f, indent=4)
