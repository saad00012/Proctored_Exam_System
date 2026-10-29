const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

const papersData = {
  // Set A
  '0FUjJXEtU1C8GfH72cXN': [
    "Which of the following is the main purpose of a class in Java?",
    "What is the result of 17 / 5 when both operands are integers?",
    "Which statement correctly creates an object of class Student?",
    "Which statement calls the display() method using object s?",
    "Which is a valid getter for an integer field age?",
    "What is a no-argument constructor?",
    "Which statement about floating-point numbers is correct?",
    "Which loop executes its body at least once, provided control enters the loop normally?",
    "Which statement creates an integer array of five elements?",
    "What is the last valid index of an array with length 8?"
  ],
  // Set B
  'NhWw7b0HJwNGtYGTXvwY': [
    "What is the main purpose of Java class libraries?",
    "Where are local primitive variables generally stored during method execution?",
    "Which method declaration returns an integer?",
    "What happens when two objects of the same class are created?",
    "What is the result of int a = 5; int b = a; b = 8;?",
    "Which suffix is required for a float literal such as 3.14?",
    "Which Java statement is useful for selecting one case from several constant choices?",
    "How many times does this loop execute? for(int i=0;i<4;i++)",
    "What is the output of int[] a={2,4,6}; System.out.print(a[0]+a[2]);?",
    "What happens when a program accesses arr[5] in an array of length 5?"
  ],
  // Set C
  '79J5ANlMsjpiicHWexWi': [
    "Which component of Java executes bytecode?",
    "What does the new keyword do when creating an object?",
    "Which declaration represents an instance variable?",
    "What is the default value of an instance variable of type boolean?",
    "If Student s1 = new Student(); Student s2 = s1;, what does s2 refer to?",
    "What is constructor overloading?",
    'What is the output of int x=7; if(x>5) System.out.print("A"); else System.out.print("B");?',
    "What is the output of for(int i=1;i<=3;i++) System.out.print(i);?",
    "Which is a valid declaration of an integer array?",
    "Given int[] a={10,20,30};, what is the value of a[1]?"
  ],
  // Set D
  'GmVAM04zbmGrshwmSDBW': [
    "What is the correct sequence for compiling and running a basic Java program?",
    "Which memory area stores objects created using new?",
    "Which members represent the state of an object?",
    "What is the purpose of a method parameter?",
    "Which is a valid setter for an integer field age?",
    "Which statement correctly creates an object using a parameterized constructor?",
    "Which statement is used for conditional decision-making in Java?",
    "Which statement is best suited to repeatedly execute a block a known number of times?",
    "Which declaration creates a two-dimensional integer array with 3 rows and 4 columns?",
    "What is the default value of elements in a newly created int[] array?"
  ]
};

async function fixQuestions() {
  console.log("Starting question repair for Unit Test-I (Object Oriented Programming)...");

  let fixedCount = 0;
  let alreadyCleanCount = 0;

  for (const [paperId, qTexts] of Object.entries(papersData)) {
    console.log(`\nProcessing Paper ${paperId}...`);
    const qSnap = await db.collection('questions').where('paperId', '==', paperId).get();
    console.log(`Found ${qSnap.size} questions for paper ${paperId}`);

    const docs = [];
    qSnap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    // Sort by order ascending
    docs.sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const correctText = qTexts[i];
      if (!correctText) continue;

      const currentText = doc.questionText || '';
      if (currentText.includes('[object') || currentText !== correctText) {
        console.log(`  Fixing Q${i + 1} (${doc.id}): "${currentText}" -> "${correctText}"`);
        await db.collection('questions').doc(doc.id).update({
          questionText: correctText
        });
        fixedCount++;
      } else {
        alreadyCleanCount++;
      }
    }
  }

  console.log("\n=================================");
  console.log(`✅ REPAIR COMPLETED!`);
  console.log(`Total questions updated: ${fixedCount}`);
  console.log(`Questions already correct: ${alreadyCleanCount}`);
  console.log("=================================");
}

fixQuestions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error fixing questions:", err);
    process.exit(1);
  });
