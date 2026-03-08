require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dns = require("dns")

const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

dns.setServers(['1.1.1.1','8.8.8.8'])

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB conectado"))
.catch(err=>console.log("Error Mongo:",err))

// =============================
// MODELOS
// =============================

const Usuario = mongoose.model("Usuario",{
    nombre:String,
    usuario:{type:String,unique:true},
    password:String,
    rol:{type:String,enum:["admin","cobrador"]},
    activo:{type:Boolean,default:true}
})

const Cliente = mongoose.model("Cliente",{
    primerNombre:String,
    segundoNombre:String,
    cedula:String,
    telefono:String,
    cobrador:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario"}
})

const Credito = mongoose.model("Credito",{
    cliente:{type:mongoose.Schema.Types.ObjectId,ref:"Cliente"},
    monto:Number,
    saldo:Number,
    fecha:Date
})

// =============================
// LOGIN
// =============================

// LOGIN ADMIN
app.post("/login-admin", async(req,res)=>{

    const {usuario,password}=req.body

    const admin=await Usuario.findOne({
        usuario,
        password,
        rol:"admin"
    })

    if(!admin){
        return res.status(401).json({mensaje:"Credenciales inválidas"})
    }

    res.json({
        id:admin._id,
        nombre:admin.nombre
    })

})

// LOGIN COBRADOR (APP MOVIL)

app.post("/login",async(req,res)=>{

    const {usuario,password}=req.body

    const cobrador=await Usuario.findOne({
        usuario,
        password,
        rol:"cobrador"
    })

    if(!cobrador){
        return res.status(401).json({mensaje:"Credenciales inválidas"})
    }

    if(!cobrador.activo){
        return res.status(403).json({mensaje:"Cuenta deshabilitada"})
    }

    res.json({
        id:cobrador._id,
        nombre:cobrador.nombre
    })

})

// =============================
// USUARIOS
// =============================

// CREAR USUARIO

app.post("/usuario",async(req,res)=>{

    try{

        const {nombre,usuario,password,rol}=req.body

        const existe=await Usuario.findOne({usuario})

        if(existe){
            return res.status(400).json({mensaje:"El usuario ya existe"})
        }

        const nuevo=new Usuario({
            nombre,
            usuario,
            password,
            rol
        })

        await nuevo.save()

        res.json({mensaje:"Usuario creado correctamente"})

    }catch(error){
        res.status(500).json({error:"Error creando usuario"})
    }

})

// BUSCAR USUARIO

app.get("/usuario/:usuario",async(req,res)=>{

    const usuario=await Usuario.findOne({usuario:req.params.usuario})

    if(!usuario){
        return res.status(404).json({mensaje:"Usuario no encontrado"})
    }

    res.json({
        usuario:usuario.usuario,
        nombre:usuario.nombre,
        rol:usuario.rol,
        activo:usuario.activo
    })

})

// DESHABILITAR USUARIO

app.put("/usuario/deshabilitar/:usuario",async(req,res)=>{

    const usuario=await Usuario.findOne({usuario:req.params.usuario})

    if(!usuario){
        return res.status(404).json({mensaje:"Usuario no encontrado"})
    }

    usuario.activo=false
    await usuario.save()

    res.json({mensaje:"Usuario deshabilitado"})

})

// LISTAR COBRADORES (para selects)

app.get("/cobradores",async(req,res)=>{

    const cobradores=await Usuario.find({
        rol:"cobrador",
        activo:true
    })

    res.json(cobradores)

})

// =============================
// CLIENTES
// =============================

// CREAR CLIENTE DESDE APP

app.post("/cliente",async(req,res)=>{

    try{

        const {primerNombre,segundoNombre,cedula,telefono,monto,cobradorId}=req.body

        const cliente=new Cliente({
            primerNombre,
            segundoNombre,
            cedula,
            telefono,
            cobrador:cobradorId
        })

        await cliente.save()

        const credito=new Credito({
            cliente:cliente._id,
            monto,
            saldo:monto,
            fecha:new Date()
        })

        await credito.save()

        res.json({cliente,credito})

    }catch(error){
        res.status(500).json({error:"Error creando cliente"})
    }

})

// CREAR CLIENTE DESDE ADMIN

app.post("/crear-cliente-admin",async(req,res)=>{

    const {primerNombre,segundoNombre,cedula,telefono,deuda,cobradorId}=req.body

    try{

        const nuevoCliente=new Cliente({
            primerNombre,
            segundoNombre,
            cedula,
            telefono,
            cobrador:cobradorId
        })

        await nuevoCliente.save()

        const nuevoCredito=new Credito({
            cliente:nuevoCliente._id,
            saldo:deuda
        })

        await nuevoCredito.save()

        res.json({mensaje:"Cliente creado correctamente"})

    }catch(error){
        res.status(500).json({error:"Error creando cliente"})
    }

})

// BUSCAR CLIENTE

app.get("/cliente/:cedula",async(req,res)=>{

    const cliente=await Cliente.findOne({cedula:req.params.cedula})

    if(!cliente){
        return res.status(404).json({mensaje:"Cliente no encontrado"})
    }

    const credito=await Credito.findOne({cliente:cliente._id})

    res.json({
        primerNombre:cliente.primerNombre,
        segundoNombre:cliente.segundoNombre,
        cedula:cliente.cedula,
        telefono:cliente.telefono,
        deuda:credito?credito.saldo:0
    })

})

// CLIENTES POR COBRADOR

app.get("/clientes/:cobradorId",async(req,res)=>{

    const clientes=await Cliente.find({cobrador:req.params.cobradorId})

    const resultado=[]

    for(let cliente of clientes){

        const credito=await Credito.findOne({cliente:cliente._id})

        resultado.push({
            primerNombre:cliente.primerNombre,
            segundoNombre:cliente.segundoNombre,
            cedula:cliente.cedula,
            telefono:cliente.telefono,
            deuda:credito?credito.saldo:0
        })
    }

    res.json(resultado)

})

// ELIMINAR DEUDA

app.put("/eliminar-deuda/:cedula",async(req,res)=>{

    const cliente=await Cliente.findOne({cedula:req.params.cedula})

    if(!cliente){
        return res.status(404).json({mensaje:"Cliente no encontrado"})
    }

    const credito=await Credito.findOne({cliente:cliente._id})

    if(!credito){
        return res.status(404).json({mensaje:"Crédito no encontrado"})
    }

    credito.saldo=0
    await credito.save()

    res.json({mensaje:"Deuda eliminada"})

})

// PAGO

app.put("/pago/:cedula",async(req,res)=>{

    const {abono}=req.body

    const cliente=await Cliente.findOne({cedula:req.params.cedula})

    if(!cliente){
        return res.status(404).json({mensaje:"No encontrado"})
    }

    const credito=await Credito.findOne({cliente:cliente._id})

    if(!credito){
        return res.status(404).json({mensaje:"Crédito no encontrado"})
    }

    credito.saldo-=abono
    await credito.save()

    res.json({nuevoSaldo:credito.saldo})

})

// =============================
// LOGISTICA
// =============================

app.get("/logistica",async(req,res)=>{

    const cobradores=await Usuario.find({rol:"cobrador"})

    const resultado=[]

    for(let cobrador of cobradores){

        const clientes=await Cliente.find({cobrador:cobrador._id})

        const clientesConDeuda=[]

        for(let cliente of clientes){

            const credito=await Credito.findOne({cliente:cliente._id})

            clientesConDeuda.push({
                nombre:cliente.primerNombre+" "+cliente.segundoNombre,
                cedula:cliente.cedula,
                telefono:cliente.telefono,
                deuda:credito?credito.saldo:0,
                estado:credito && credito.saldo>0?"Con deuda":"Al día"
            })

        }

        resultado.push({
            usuario:cobrador.usuario,
            nombre:cobrador.nombre,
            activo:cobrador.activo,
            clientes:clientesConDeuda
        })

    }

    res.json(resultado)

})

// =============================
// HEALTH CHECK
// =============================

app.get("/",(req,res)=>{
    res.json({
        estado:"Servidor funcionando 🚀"
    })
})

// =============================
// INICIAR SERVER
// =============================

if(!process.env.VERCEL){
    app.listen(PORT,()=>{
        console.log("Servidor en puerto",PORT)
    })
}

module.exports=app