const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nxi2d.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        // console.log(decoded);
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const appointmentCollection = client.db("doctors_portal").collection("appointments");
        const userCollection = client.db("doctors_portal").collection("users");
        const doctorCollection = client.db("doctors_portal").collection("doctors");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden access' })
            }
        }

        // get data
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
        })
        app.get('/appointment', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const cursor = appointmentCollection.find(query);
                const appointment = await cursor.toArray();
                return res.send(appointment)
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 14, 2022';

            // step-1: get all services
            const services = await serviceCollection.find().toArray();

            // step-2: get the appointments of the day
            const query = { date: date };
            const appointments = await appointmentCollection.find(query).toArray();

            services.forEach(service => {
                const serviceAppointments = appointments.filter(appointment => appointment.treatment === service.name)
                const bookedSlots = serviceAppointments.map(book => book.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            });
            res.send(services);
        })
        app.get('/user', verifyJWT, async (req, res) => {
            const user = await userCollection.find().toArray();
            res.send(user)
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = await doctorCollection.find().toArray();
            res.send(doctor)
        })

        // post data
        app.post('/appointment', async (req, res) => {
            const data = req.body;
            const query = { treatment: data.treatment, date: data.date, patient: data.patient };
            const exist = await appointmentCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, data: exist })
            }
            const appointment = await appointmentCollection.insertOne(data);
            res.send({ success: true, appointment })
        })
        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })

        // put (upsert) data
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token })
        })
        app.put('/user/admin/:email', verifyAdmin, verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // delete data
        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result)
        })

    }
    catch (error) {
        console.error(error);
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from Doctor Website!')
})

app.listen(port, () => {
    console.log(`Doctor uncle is listening on port ${port}`)
})