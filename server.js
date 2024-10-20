const express = require('express'); // use express
const path = require('path'); // get the path directory
const mysql = require('mysql');
const http = require('http');
const axios = require('axios'); // for hunter api
const multer = require('multer'); // for handling file uploads
const fs = require('fs');
const compiler = require("compilex");
const options = { stats: true };
const bodyP = require("body-parser");

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "{\n\nquestion: \"\",\nsource_code: \"\",\ninput given: \"\",\n  output: 'Hello World!',\nexpected_output: \"\",\n\n  memory: '3072',\n  cpuTime: '0.00',\n  error: null\n}\nyou will be given a json file in this format. you have to see the question and the source_code and see wether the source_code matches to what is asked in the question. compare the output with the expected output. on this basis you have to give a score to the code out of 100.\n\n\nonly give the score(score/10)\njudging criteria:-\nsource_code according to question\ntime take by cpu\nmemory usage\ncode redability and explanation",
});

const generationConfig = {
    temperature: 0.15,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};



compiler.init(options);

const app = express(); // calling express function
const server = http.createServer(app);

app.use(bodyP.json());

app.use(express.json()); // sending and receiving JSON files

app.set('view engine', 'ejs'); // using ejs
app.set('views', path.join(__dirname, 'views')); // setting up viewpath

// Add MySQL connection
const db = mysql.createConnection({
    host: 'localhost',  // replace with your MySQL host
    user: 'root',       // replace with your MySQL user
    password: '',       // replace with your MySQL password
    database: 'xyz_college' // replace with your MySQL database name
});
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

function openFiles() {
    // Serve static files from the "public" directory
    const publicpath = path.join(__dirname, 'public');
    app.use(express.static(publicpath));

    app.get('/login', (_, resp) => {
        resp.sendFile(path.join(publicpath, 'login/index1.html'));
    });

    app.get('/search', (_, resp) => {
        resp.sendFile(path.join(publicpath, 'search/search.html'));
    });

    app.get('/create', (_, resp) => {
        resp.sendFile(path.join(publicpath, 'create/index2.html'));
    });

    app.get('/alumni', (_, resp) => {
        resp.sendFile(path.join(publicpath, '/alumni/Alumni.html'));
    });

    app.get('/notification', (_, resp) => {
        resp.sendFile(path.join(publicpath, '/notifications/notifications.html'))
    });

    app.get('/coding', (_, resp) => {
        resp.sendFile(path.join(publicpath, '/coding/index.html'));
    });

    app.get('/messages', (_, resp) => {
        resp.sendFile(path.join(publicpath, "/messages/message.html"));
    });

    app.get('/contest', (_, resp) => {
        resp.sendFile(path.join(publicpath, "/contest/contest.html"));
    });

    app.get('/profile', (_, resp) => {
        // You can also add other necessary data here
        resp.render('profile', { monthlyScore: yourMonthlyScore });
    });
    
}

//login page submission
function handleFormSubmission() {
    // Handle form submission
    app.post('/submit-form', async (req, res) => {
        try {
            const { username, password } = req.body;

            // Hunter.io API Key

            // Verify email using Hunter.io
            const emailVerificationUrl = `https://api.hunter.io/v2/email-verifier?email=${username}&api_key=${apiKey}`;

            const response = await axios.get(emailVerificationUrl);

            // Check if email is deliverable
            if (response.data && response.data.data && response.data.data.result === 'deliverable') {
                res.status(200).json({ message: 'Form submitted successfully!' });
            } else {
                res.status(400).json({ message: 'Email is not deliverable' });
            }
        } catch (error) {
            console.error('Error processing the form submission:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    });
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/images/uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Route to handle image upload
app.post('/upload-photo', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const imagePath = `images/uploads/${req.file.filename}`;
    const { username, caption } = req.body;

    // Insert the image path and other form data into the database
    const query = "INSERT INTO posts (userId, writtenContent, imageUploaded) VALUES ((SELECT userId FROM users WHERE username = ?), ?, ?)";

    db.query(query, [username, caption, imagePath], (err, result) => {
        if (err) {
            console.error('Error saving image to the database:', err);
            return res.status(500).send('Database error');
        }
        res.status(200).send('Image uploaded successfully');
    });
});



//home page posting feature
app.get('/', (req, resp) => {
    let query = "SELECT users.username, users.profilePicture, posts.likeCount, posts.commentCount, posts.writtenContent, posts.imageUploaded FROM users JOIN posts ON users.userId = posts.userId";
    db.query(query, (err, results, fields) => {
        if (err) {
            console.log(err);
            resp.status(500).send("Error retrieving posts");
        } else {
            resp.render('index', { posts: results });
        }
    });
});

//compiling code
app.post("/compile", function (req, resp) {
    var code = req.body.code;
    var input = req.body.input;
    var lang = req.body.lang;

    try {
        if (lang == "C++") {
            var envData = { OS: "windows", cmd: "g++", options: { timeout: 10000 } };
            if (!input) {
                compiler.compileCPP(envData, code, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            } else {
                compiler.compileCPPWithInput(envData, code, input, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            }
        } else if (lang == "Java") {
            var envData = { OS: "windows" };
            if (!input) {
                compiler.compileJava(envData, code, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            } else {
                compiler.compileJavaWithInput(envData, code, input, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            }
        } else if (lang == "Python") {
            var envData = { OS: "windows" };
            if (!input) {
                compiler.compilePython(envData, code, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            } else {
                compiler.compilePythonWithInput(envData, code, input, function (data) {
                    if (data.output) {
                        resp.json({ output: data.output });  // Send JSON response
                    } else {
                        resp.json({ output: "error" });  // Send JSON error response
                    }
                });
            }
        }
    } catch (e) {
        resp.json({ output: "error" });  // Send JSON error response
    }
});

let yourMonthlyScore="0";

//code submission
const jDoodle_clientId = "789ad5e4a24cd83721c3f5a22e0cdd85";
const jDoodle_client_Secret = "d8018a9f8886e60b961c1ea19fe56fbb50edbab0571e6bf634ee1101b88228f8";
app.use(bodyP.json());
app.use(bodyP.urlencoded({ extended: true }));
const coding_question = `Chef has recently been playing a lot of chess in preparation for the ICCT (International Chef Chess Tournament).
Since putting in long hours is not an easy task, Chef's mind wanders elsewhere. He starts counting the number of squares with odd side length on his chessboard.
However, Chef is not satisfied. He wants to know the number of squares of odd side length on a generic N*N chessboard.
### Input:
The first line will contain a single integer T, the number of test cases.
The next T lines will have a single integer N, the size of the chess board.
### Output: For each test case, print an integer denoting the number of squares with odd length.`;
let Expected_output = "10\n120";
app.post('/submit', async (req, res) => {
    const { code, language } = req.body;

    const languageMap = {
        "C++": { language: "cpp17", versionIndex: "0" },
        "Java": { language: "java", versionIndex: "4" },
        "Python": { language: "python3", versionIndex: "3" },
    };

    const jdoodleLang = languageMap[language];
    const customInput = "2\n3\n8";  // Ensure this matches what your code expects

    try {
        // Step 1: Send code to JDoodle API
        const jdoodleResponse = await axios.post("https://api.jdoodle.com/v1/execute", {
            script: code,
            language: jdoodleLang.language,
            versionIndex: jdoodleLang.versionIndex,
            clientId: jDoodle_clientId,
            clientSecret: jDoodle_client_Secret,
            "stdin": customInput
        });

        const formattedResponse = {
            question: coding_question,
            input_given: customInput,
            output: jdoodleResponse.data.output,
            expected_output: Expected_output,
            source_code: code,
            memory: jdoodleResponse.data.memory,
            cpuTime: jdoodleResponse.data.cpuTime,
            error: jdoodleResponse.data.error
        };

        console.log("Formatted Response:", formattedResponse);

        // Step 2: Send formatted response to Google API
        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        { text: JSON.stringify(formattedResponse) },
                    ],
                },
            ],
        });

        const googleResponse = await chatSession.sendMessage("INSERT_INPUT_HERE");
        console.log(googleResponse.response.text().trim() + `0`);
        yourMonthlyScore=googleResponse.response.text().trim() + `0`
        
    } catch (error) {
        console.error('Error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: "Server error", details: error.message });
        }
    }
});

// app.get('/find', (req, res) => {
//     const searchTerm = req.query.term;
//     const query = "SELECT * FROM users WHERE username LIKE ?";
//     db.query(query, [`%${searchTerm}%`], (err, results) => {
//         if (err) {
//             res.status(500).send('Database error');
//         } else {
//             res.json(results);
//         }
//     });
// });


function main() {
    openFiles();
    handleFormSubmission();
}
main();


app.listen(3000, () => {
    console.log('Server started at port 3000');
});
