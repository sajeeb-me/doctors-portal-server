const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nxi2d.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const appointmentCollection = client.db("doctors_portal").collection("appointments");

        // get data
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
        })
        app.get('/appointment', async (req, res) => {
            const query = {};
            const cursor = appointmentCollection.find(query);
            const appointment = await cursor.toArray();
            res.send(appointment)
        })

        // post data
        app.post('/appointment', async (req, res) => {
            const data = req.body;
            const appointment = await appointmentCollection.insertOne(data);
            res.send(appointment)
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