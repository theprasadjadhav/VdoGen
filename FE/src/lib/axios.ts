import axios from "axios";


const baseAxios = axios.create({
    baseURL: "http://localhost:8081",
    headers: {
        "Content-Type": "application/json"
    }
})


export {baseAxios}