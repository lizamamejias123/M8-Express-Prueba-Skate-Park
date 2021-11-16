// Importar dependencias
const express = require('express')
const app = express();
const bodyParser = require('body-parser');
require('dotenv').config();
const exphbs = require('express-handlebars');
const expressFileUpload = require('express-fileupload');
const jwt = require('jsonwebtoken');
const secretKey = 'Mi Llave Ultra Secreta';

// Importar funciones
const { consultarUsuarios,
    nuevoUsuario,
    setUsuarioStatus,
    conseguirUsuario,
    setDatosUsuario,
    eliminarCuenta } = require('./consultas');

// Iniciar servidor
app.listen(3000,()=>{
    console.log(`Servidor ON`)
});

// Configuraciones de paquetes

// Integrar de body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Directorio público
app.use(express.static(__dirname + '/public'));
app.use(express.static('archivos'));

// Middleware para express-fileupload
app.use( expressFileUpload({
    limits: { fileSize: 5000000},
    abortOnLimit: true,
    responseOnLimit: 'El peso del archivo que intentas subir supera el limite permitido',
})
)

// Importar motor de plantillas handlebars
app.set('view engine','handlebars');

// Configurar motor de plantillas
app.engine(
    'handlebars',
    exphbs({
        defaultLayout: 'main',
        layoutsDir: __dirname + '/views/main',
    })
)

// Ruta raíz
app.get('/', (req,res) => {
    res.render('Home');
})

// Ruta para registro
app.get('/registro',(req,res) => {
    res.render('Registro')
})

// Ruta para login
app.get('/login',(req,res) => {
    res.render('Login')
})

// Ruta para admin
app.get('/admin', async (req,res) => {
    try {
        const usuarios = await consultarUsuarios()
        res.render('Admin', { usuarios })
    } catch (e) {
        res.status(500).send({
            error: `Algo salió mal... ${e}`,
            code: 500
        })
    }
})

// Ruta GET /usuarios
app.get('/usuarios', async (req,res) => {
    const respuesta = await consultarUsuarios();
    res.send(respuesta);
})

// Ruta POST /usuario
app.post('/usuario', async (req,res) => {
    console.log(req.files.foto.name)
    const nombre_foto = req.files.foto.name
    const { email,nombre,password,anhos,especialidad } = req.body; 
    try {
        const respuesta = await nuevoUsuario(email,nombre,password,anhos,especialidad,nombre_foto);
        await req.files.foto.mv(__dirname+"/public/img/"+nombre_foto)
        res.status(201).send(respuesta);
    } catch (e) {
        res.status(500).send({
            error: `Algo salió mal... ${e}`,
            code: 500
        })
    }
})

// Ruta POST /subir_foto
app.post('/registrar',async (req,res) => {

    const { email,nombre,password,password_2,anhos,especialidad } = req.body;
    const { foto } = req.files;
    const { name } = foto;
   
    if ( password !== password_2) { 
        res.send('<script>alert("Las contraseñas no coinciden."); window.location.href = "/registro"; </script>');
    } else {
        try {
            const respuesta = await nuevoUsuario(email,nombre,password,anhos,especialidad,name)
            .then(() => {
                foto.mv(`${__dirname}/public/uploads/${name}`,(err) => {
                    res.send('<script>alert("Se ha registrado con éxito."); window.location.href = "/login"; </script>');
                });
            })
            
        } catch (e) {
            res.status(500).send({
                error: `Algo salió mal... ${e}`,
                code: 500
            })
        }
    }
    
})

// Ruta PUT para cambiar estado de usuario
app.put('/usuarios', async (req,res) => {
    const { id,estado } = req.body;
    try {
        const usuario = await setUsuarioStatus(id,estado);
        res.status(200).send(usuario);
    } catch (e) {
        res.status(500).send({
            error: `Algo salió mal... ${e}`,
            code: 500
        })
    }
})

// Ruta POST para inicio de sesión
app.post('/verify', async (req,res) => {
    const { email,password } = req.body;
    const user = await conseguirUsuario(email,password)

    if (email === '' || password === '') {
        res.status(401).send({
            error:'Debe llenar todos los campos',
            code: 401,
        })
    } else {

        if(user.length != 0 ) {
            if ( user[0].estado === true) {
                const token = jwt.sign(
                    {
                        exp: Math.floor(Date.now() / 1000) + 180,
                        data: user,
                    },
                    secretKey
                );
                res.send(token);
            } else {
                res.status(401).send({
                    error:'El registro de este usuario no ha sido aprobado',
                    code: 401,
                })
            }
        } else {
            res.status(404).send({
                error: 'Este usuario no está registrado en la base de datos o la contraseña es incorrecta.',
                code: 404,
            });
        }
    }
    
});

// Ruta para datos
app.get('/datos',(req,res) => {
    const { token } = req.query;
    jwt.verify(token, secretKey, (err,decoded) => {
        const { data } = decoded
        /* const { nombre,email } = data */
        const email = data[0].email;
        const nombre = data[0].nombre;
        const password = data[0].password;
        const anos_experiencia = data[0].anos_experiencia;
        const especialidad = data[0].especialidad;
        err
            ? res.status(401).send({
                error : '401 Unauthorized',
                message: 'Usted no está autorizado para estar aquí',
                token_error: err.message,
            })
            : res.render('datos', { email,nombre,password,anos_experiencia,especialidad })
    })
})

// Ruta GET /datos_usuario
app.get('/datos_usuario', async (req,res) => {
    const respuesta = await consultarUsuarios();
    res.send(respuesta);
})


// Ruta PUT para cambiar datos de usuario
app.put('/datos_perfil', async (req,res) => {
    const { email,nombre,password,anhos,especialidad } = req.body;

    try {
        const usuario = await setDatosUsuario(email,nombre,password,anhos,especialidad);
        res.status(200).send(usuario);
    } catch (e) {
        res.status(500).send({
            error: `Algo salió mal... ${e}`,
            code: 500
        })
    }
})

// Ruta DELETE para eliminar cuenta
app.delete('/eliminar_cuenta/:email', async (req,res) => {
    
    try {
        const { email } = req.params;
        const respuesta = await eliminarCuenta(email);
        res.sendStatus(200).send(respuesta);
        
    } catch (e) {
        res.status(500).send({
            error: `Algo salió mal... ${e}`,
            code: 500
        })
    }
})