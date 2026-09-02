import express from "express"
import controlPanelRouter from "./routes/controlPanelRoutes.js";

const app = express();
const port = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }))


app.get("/health", (req,res)=>{
    res.send("api is working!");
})
app.use("/api/controlpanel",controlPanelRouter)


app.listen(port,()=>{
    console.log("server started at port",`http://localhost:${port}`);
})