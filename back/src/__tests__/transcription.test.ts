import request from "supertest";
import app from "../app"
import path from "path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

describe("CRUD operations for Transcriptions", () => {
    const newSource = {
        title: "JT 5-11-2024-19h",
        description: "Description of JT 5-11-2024-19h",
        video: path.resolve(__dirname, "fixtures/5-11-2024-19h.mp4"),
        audio: path.resolve(__dirname, "fixtures/5-11-2024-19h.wav"),
    };

    let sourceId: number;

    beforeAll(async () => {
        const response = await request(app)
            .post("/source")
            .field("title", newSource.title)
            .field("description", newSource.description)
            .attach("audio", newSource.audio);
        sourceId = response.body.data?.id;


        // let's create a transcription for sourceId 
        await prisma.transcription.create({
            data: {
                sourceId: sourceId,
                content: "This is a test transcription 1",
            }
        })

        // now let's create a second transcription for sourceId
        await prisma.transcription.create({
            data: {
                sourceId: sourceId,
                content: "This is a test transcription2",
            }
        })
    })

    afterAll(async () => {
        await prisma.$disconnect();
        // order of deletion matters
        await prisma.task.deleteMany();
        await prisma.transcription.deleteMany();
        await prisma.source.deleteMany();
    })


    describe("POST /transcription", () => {
        it("should return a unique task id and sourceid", async () => {
            const response = await request(app).post("/transcription").send({ sourceId: sourceId, skipTranscription : true })
            expect(response.body.data.taskId).toBeDefined();
            expect(response.body.data.sourceId).toBe(sourceId);
            expect(response.status).toBe(201);
        })

        it("should return error 400 if sourceid does not exists", async () => {
            const response = await request(app).post("/transcription").send({ sourceId: 999999 })
            expect(response.body.error).toBe("Internal Server Error");
            expect(response.status).toBe(400);
        })

        it("should return error 400 if sourceId is missing", async () => {
            const response = await request(app).post("/transcription")
            expect(response.body.error).toBe("Internal Server Error");
            expect(response.body.details).toBe("sourceId is required");
            expect(response.status).toBe(400);
        })

    })

    describe("GET /transcription", () => {
        it("should return all transcriptions", async () => {
            const response = await request(app).get("/transcription")
            const transcriptions = await prisma.transcription.findMany()
            expect(response.status).toBe(200);
            expect(transcriptions.length).toBe(response.body.data.length)
        })
        it("should return a transcription by id", async () => {
            const transcriptions = await prisma.transcription.findMany();
            const transcriptionId = transcriptions[0].id;

            const response = await request(app).get(`/transcription/${transcriptionId}`);
            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe(transcriptionId);
        })

        it("should return error 400 if id is not a number", async () => {
            const transcriptionId = "fake"
            const response = await request(app).get(`/transcription/${transcriptionId}`);
            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Internal Server Error");
            expect(response.body.details).toBeDefined();
        })
    })

    describe("GET /transcription", () => {
        it("should delete a transcription by id", async () => {
            const transcriptions = await prisma.transcription.findMany();
            const transcriptionId = transcriptions[0].id;
            const response = await request(app).delete(`/transcription/${transcriptionId}`);
            expect(response.status).toBe(201);
            expect(response.body.data.id).toBe(transcriptionId);
        })

        it("should return an error 400 if transcription id is invalid", async () => {
            const invalidTranscriptionId = "fake";
            const response = await request(app).delete(`/transcription/${invalidTranscriptionId}`);
            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Internal Server Error");
            expect(response.body.details).toBeDefined();
        })
    })

    describe("PUT /transcriptipn",()=>{
        it("should return an error 400 if id is not provided",async()=>{
            const response = await request(app).put(`/transcription`);

            expect(response.status).toBe(400)
            expect(response.body.error).toBe("Internal Server Error");
            expect(response.body.details).toBe("transcription id must be provide")
        })

        it("should return a status 201 and updated transcription",async()=>{
            const transcriptions = await prisma.transcription.findMany();
            const transcriptionId = transcriptions[0].id;
            const transcriptionContent = "Fake transcription content"
            const response = await request(app).put(`/transcription/${transcriptionId}`).send({content:transcriptionContent})
            expect(response.body.data.content).toBe(transcriptionContent);
            expect(response.body.data.id).toBe(transcriptionId);
        })
    })
})