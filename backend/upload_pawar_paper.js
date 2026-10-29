const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

const teacher = {
  uid: "UrMa3EQviUUgIKcea4a95K3GUoC2",
  name: "Prof.Pawar.S.D",
  email: "swati.pawar@dnyanshree.edu.in",
  department: "Computer Science & Engineering"
};

const examMeta = {
  name: "Unit Test-I",
  subject: "Object Oriented Programming",
  department: "Computer Science & Engineering",
  semester: "Semester 3",
  durationMinutes: 45,
  passingPercentage: 40,
  scheduleStart: "2026-10-28T10:00",
  scheduleEnd: "2026-10-28T18:00",
  status: "published",
  importedFrom: "excel",
  createdAt: new Date().toISOString(),
  createdById: teacher.uid,
  createdBy: teacher.name,
  createdByEmail: teacher.email,
  isVisible: true,
  isHidden: false,
  isStarted: false
};

const sets = {
  "Set A": [
    {
      q: "Which of the following is the main purpose of a class in Java?",
      opts: ["A. To store only numbers", "B. To define the properties and behaviour of objects", "C. To execute only loops", "D. To allocate disk space"],
      ans: 1, marks: 2
    },
    {
      q: "What is the result of 17 / 5 when both operands are integers?",
      opts: ["A) 3.4", "B) 2", "C) 3", "D) 4"],
      ans: 2, marks: 2
    },
    {
      q: "Which statement correctly creates an object of class Student?",
      opts: ["A) Student();", "B) new Student;", "C) Student s = new Student();", "D) class Student = new;"],
      ans: 2, marks: 2
    },
    {
      q: "Which statement calls the display() method using object s?",
      opts: ["A) s->display();", "B) s.display();", "C) display.s();", "D) s:display();"],
      ans: 1, marks: 2
    },
    {
      q: "Which is a valid getter for an integer field age?",
      opts: ["A) void getAge() { return age; }", "B) int getAge() { return age; }", "C) getAge(int age)", "D) int age = getAge;"],
      ans: 1, marks: 2
    },
    {
      q: "What is a no-argument constructor?",
      opts: ["A) A constructor with no parameters", "B) A method with no body", "C) A constructor returning no value but having parameters", "D) A static method"],
      ans: 0, marks: 2
    },
    {
      q: "Which statement about floating-point numbers is correct?",
      opts: ["A) They always represent every decimal value exactly", "B) They can have rounding errors because many decimal fractions are not represented exactly in binary", "C) They cannot represent fractions", "D) float always has greater precision than double"],
      ans: 1, marks: 2
    },
    {
      q: "Which loop executes its body at least once, provided control enters the loop normally?",
      opts: ["A) for", "B) while", "C) do-while", "D) Enhanced for never"],
      ans: 2, marks: 2
    },
    {
      q: "Which statement creates an integer array of five elements?",
      opts: ["A) int arr = new int(5);", "B) int[] arr = new int[5];", "C) int[5] arr;", "D) array arr = int[5];"],
      ans: 1, marks: 2
    },
    {
      q: "What is the last valid index of an array with length 8?",
      opts: ["A) 8", "B) 9", "C) 6", "D) 7"],
      ans: 3, marks: 2
    }
  ],
  "Set B": [
    {
      q: "What is the main purpose of Java class libraries?",
      opts: ["A. To provide reusable predefined classes and methods", "B. To replace the JVM", "C. To store only source files", "D. To prevent object creation"],
      ans: 0, marks: 2
    },
    {
      q: "Where are local primitive variables generally stored during method execution?",
      opts: ["A) Stack frame", "B) Java package", "C) Source file", "D) Class library"],
      ans: 0, marks: 2
    },
    {
      q: "Which method declaration returns an integer?",
      opts: ["A) void getAge()", "B) int getAge()", "C) getAge int()", "D) return getAge()"],
      ans: 1, marks: 2
    },
    {
      q: "What happens when two objects of the same class are created?",
      opts: ["A) Both must share all instance variables", "B) Each has its own instance variables", "C) The class is duplicated in source code", "D) Only one object is allowed"],
      ans: 1, marks: 2
    },
    {
      q: "What is the result of int a = 5; int b = a; b = 8;?",
      opts: ["A) a becomes 8", "B) a remains 5", "C) Both become 8", "D) Compilation fails"],
      ans: 1, marks: 2
    },
    {
      q: "Which suffix is required for a float literal such as 3.14?",
      opts: ["A) I", "B) D", "C) F or f", "D) B"],
      ans: 2, marks: 2
    },
    {
      q: "Which Java statement is useful for selecting one case from several constant choices?",
      opts: ["A) switch", "B) while", "C) continue", "D) import"],
      ans: 0, marks: 2
    },
    {
      q: "How many times does this loop execute? for(int i=0;i<4;i++)",
      opts: ["A) 3", "B)Infinite times", "C) 5", "D) 4"],
      ans: 3, marks: 2
    },
    {
      q: "What is the output of int[] a={2,4,6}; System.out.print(a[0]+a[2]);?",
      opts: ["A) 6", "B) 10", "C) 8", "D) 12"],
      ans: 2, marks: 2
    },
    {
      q: "What happens when a program accesses arr[5] in an array of length 5?",
      opts: ["A) It accesses the fifth element", "B) It returns zero", "C) It throws ArrayIndexOutOfBoundsException", "D) The array grows automatically"],
      ans: 2, marks: 2
    }
  ],
  "Set C": [
    {
      q: "Which component of Java executes bytecode?",
      opts: ["A. JDK", "B. JRE", "C. JVM", "D. Javadoc"],
      ans: 2, marks: 2
    },
    {
      q: "What does the new keyword do when creating an object?",
      opts: ["A) Imports a package", "B) Allocates memory for an object", "C) Deletes a class", "D) Compiles a file"],
      ans: 1, marks: 2
    },
    {
      q: "Which declaration represents an instance variable?",
      opts: ["A) static int count;", "B) int marks; declared directly inside a class, outside methods", "C) int x; declared inside a method", "D) import java.util.*;"],
      ans: 1, marks: 2
    },
    {
      q: "What is the default value of an instance variable of type boolean?",
      opts: ["A) true", "B) false", "C) 0", "D) null"],
      ans: 1, marks: 2
    },
    {
      q: "If Student s1 = new Student(); Student s2 = s1;, what does s2 refer to?",
      opts: ["A) A new independent object", "B) The same object as s1", "C) The Student class file", "D) A primitive value"],
      ans: 1, marks: 2
    },
    {
      q: "What is constructor overloading?",
      opts: ["A) Using several constructors with different parameter lists", "B) Defining a constructor inside a loop", "C) Giving a constructor a return type", "D) Calling a method repeatedly"],
      ans: 0, marks: 2
    },
    {
      q: 'What is the output of int x=7; if(x>5) System.out.print("A"); else System.out.print("B");?',
      opts: ["A) A", "B) B", "C) AB", "D) No output"],
      ans: 0, marks: 2
    },
    {
      q: "What is the output of for(int i=1;i<=3;i++) System.out.print(i);?",
      opts: ["A) 012", "B) 1234", "C) 321", "D) 123"],
      ans: 3, marks: 2
    },
    {
      q: "Which is a valid declaration of an integer array?",
      opts: ["A) int arr;", "B) int[] arr;", "C) array int arr;", "D) arr[] int;"],
      ans: 1, marks: 2
    },
    {
      q: "Given int[] a={10,20,30};, what is the value of a[1]?",
      opts: ["A) 10", "B) 20", "C) 30", "D) 1"],
      ans: 1, marks: 2
    }
  ],
  "Set D": [
    {
      q: "What is the correct sequence for compiling and running a basic Java program?",
      opts: ["A. Run source → compile → execute", "B. Compile source → generate bytecode → execute bytecode", "C. Generate bytecode → write source → compile", "D. Execute bytecode → compile source → write source"],
      ans: 1, marks: 2
    },
    {
      q: "Which memory area stores objects created using new?",
      opts: ["A) Stack only", "B) Heap", "C) Register", "D) Source file"],
      ans: 1, marks: 2
    },
    {
      q: "Which members represent the state of an object?",
      opts: ["A) Instance variables", "B) Comments", "C) Import statements", "D) Packages"],
      ans: 0, marks: 2
    },
    {
      q: "What is the purpose of a method parameter?",
      opts: ["A) To pass input to a method", "B) To create a package", "C) To stop compilation", "D) To delete an object"],
      ans: 0, marks: 2
    },
    {
      q: "Which is a valid setter for an integer field age?",
      opts: ["A) void setAge(int a) { age = a; }", "B) int setAge() { age; }", "C) setAge void(int a)", "D) void age(int) = setAge;"],
      ans: 0, marks: 2
    },
    {
      q: "Which statement correctly creates an object using a parameterized constructor?",
      opts: ["A) new Point;", "B) Point p = new Point(3, 4);", "C) Point(3, 4) = p;", "D) Point p = Point(3, 4);"],
      ans: 1, marks: 2
    },
    {
      q: "Which statement is used for conditional decision-making in Java?",
      opts: ["A) if", "B) import", "C) package", "D) new"],
      ans: 0, marks: 2
    },
    {
      q: "Which statement is best suited to repeatedly execute a block a known number of times?",
      opts: ["A) if", "B) switch", "C) for", "D) break"],
      ans: 2, marks: 2
    },
    {
      q: "Which declaration creates a two-dimensional integer array with 3 rows and 4 columns?",
      opts: ["A) int[][] a = new int[3][4];", "B) int[] a = new int[3,4];", "C) int a = new int[3][4];", "D) int[][] a = new int(3,4);"],
      ans: 0, marks: 2
    },
    {
      q: "What is the default value of elements in a newly created int[] array?",
      opts: ["A) 1", "B) -1", "C) 0", "D) null"],
      ans: 2, marks: 2
    }
  ]
};

async function uploadExam() {
  console.log(`Creating fresh exam for ${teacher.name} (${teacher.email})...`);
  const examRef = await db.collection('exams').add(examMeta);
  console.log(`✅ Exam created with ID: ${examRef.id}`);

  for (const [setName, qList] of Object.entries(sets)) {
    console.log(`Creating paper ${setName}...`);
    const paperRef = await db.collection('papers').add({
      title: setName,
      examId: examRef.id,
      subject: examMeta.subject,
      department: examMeta.department,
      semester: examMeta.semester,
      durationMinutes: examMeta.durationMinutes,
      scheduleStart: examMeta.scheduleStart,
      scheduleEnd: examMeta.scheduleEnd,
      passingPercentage: examMeta.passingPercentage,
      status: "published",
      isVisible: true,
      isHidden: false,
      isStarted: false,
      createdAt: new Date().toISOString(),
      createdById: teacher.uid,
      createdBy: teacher.name,
      createdByEmail: teacher.email
    });
    console.log(`  Paper ${setName} created: ${paperRef.id}`);

    const qPromises = qList.map((item, idx) => {
      const options = item.opts.map(o => ({ text: o.trim(), imageUrl: null }));
      return db.collection('questions').add({
        paperId: paperRef.id,
        questionText: item.q.trim(),
        questionImageUrl: null,
        options,
        correctOptionIndex: item.ans,
        marks: item.marks || 2,
        order: idx,
        department: examMeta.department
      });
    });

    await Promise.all(qPromises);
    console.log(`  Added ${qList.length} questions for ${setName}`);
  }

  console.log("\n========================================================");
  console.log(`🎉 SUCCESS: Exam & all 4 sets uploaded directly to ${teacher.email}`);
  console.log(`Exam ID: ${examRef.id}`);
  console.log(`Exam Name: ${examMeta.name}`);
  console.log(`Subject: ${examMeta.subject}`);
  console.log(`Teacher: ${teacher.name} (${teacher.email})`);
  console.log("========================================================");
}

uploadExam()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Failed to upload exam:", err);
    process.exit(1);
  });
