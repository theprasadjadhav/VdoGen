import axios from "axios";


const baseAxios = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL,
    headers: {
        "Content-Type": "application/json"
    }
})


export {baseAxios}