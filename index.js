const express = require('express');
const ExcelJS = require('exceljs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const port = process.env.PORT || 3000;
const app = express();

// CORS config
const corsOptions = {
    origin: 'https://riesgo-ten.vercel.app/',
    credentials: true,
};
app.use(cors(corsOptions));

// Servir archivos estáticos si los hubiera
app.use(express.static(path.join(__dirname, 'public')));

// =================== CONFIGURACIÓN GOOGLE DRIVE ===================

const KEYFILEPATH = path.join(__dirname, 'credentials.json'); // Ruta del JSON de cuenta de servicio
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const FILE_ID = '18TiO3g2m1a7lPQhMB9Mol7MO4YtlkqzS'; // ⚠️ REEMPLAZALO con el ID real

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

async function descargarArchivoDesdeDrive(fileId, outputPath) {
    const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

    const response = await drive.files.get({
        fileId: fileId,
        alt: 'media',
    }, { responseType: 'stream' });

    return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(outputPath);
        response.data.pipe(dest);
        dest.on('finish', () => resolve(outputPath));
        dest.on('error', reject);
    });
}

// =================== RUTA PRINCIPAL ===================

app.get('/get-datos', async (req, res) => {
    const localPath = path.join(__dirname, 'temp.xlsx');

    try {
        // Descargar archivo desde Google Drive
        await descargarArchivoDesdeDrive(FILE_ID, localPath);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(localPath);

        const hoja1 = workbook.getWorksheet('Hoja1');
        const hoja2 = workbook.getWorksheet('Hoja2');
        const hoja3 = workbook.getWorksheet('Hoja3');

        if (!hoja1 || !hoja2 || !hoja3) {
            return res.status(400).json({ error: 'No se pudieron encontrar las hojas "Hoja1", "Hoja2" o "Hoja3".' });
        }

        const datosHoja1 = [];
        const transporteMap = {};
        const datosHoja3 = [];

        // Procesar Hoja 1
        hoja1.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const coordenadasx = row.getCell(29).value;
            const coordenadasy = row.getCell(30).value;
            const xValue = coordenadasx && coordenadasx.result !== undefined ? coordenadasx.result : coordenadasx;
            const yValue = coordenadasy && coordenadasy.result !== undefined ? coordenadasy.result : coordenadasy;

            datosHoja1.push({
                cliente: row.getCell(1).value,
                pdv: row.getCell(3).value,
                menos50m: row.getCell(11).value,
                accesoSinCruce: row.getCell(12).value,
                accesoCarro: row.getCell(13).value,
                ingresoEscaleras: row.getCell(14).value,
                buenaIluminacion: row.getCell(15).value,
                seguridad5s: row.getCell(16).value,
                trabajoAltura: row.getCell(17).value,
                riesgoElectricidad: row.getCell(18).value,
                clientesViolentos: row.getCell(19).value,
                manejaEfectivo: row.getCell(20).value,
                animalesSueltos: row.getCell(21).value,
                zonaEscolar: row.getCell(22).value,
                caminoTransitable: row.getCell(23).value,
                zonaPeligrosa: row.getCell(24).value,
                riesgoTotal: row.getCell(28).value,
                coordenadasx: xValue,
                coordenadasy: yValue
            });
        });

        // Procesar Hoja 2
        hoja2.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const transporte = row.getCell(43).value;
            const cliente = row.getCell(23).value;
            const descripcionCliente = row.getCell(25).value;
            const bultos = row.getCell(11).value;

            if (transporte) {
                if (!transporteMap[transporte]) {
                    transporteMap[transporte] = { bultos: 0, clientes: {} };
                }

                if (!transporteMap[transporte].clientes[cliente]) {
                    transporteMap[transporte].clientes[cliente] = {
                        descripcionCliente,
                        bultos: 0,
                        riesgoTotal: 0,
                        menos50m: "No disponible",
                        accesoSinCruce: "No disponible",
                        accesoCarro: "No disponible",
                        ingresoEscaleras: "No disponible",
                        buenaIluminacion: "No disponible",
                        seguridad5s: "No disponible",
                        trabajoAltura: "No disponible",
                        riesgoElectricidad: "No disponible",
                        clientesViolentos: "No disponible"
                    };
                }

                transporteMap[transporte].bultos += bultos;
                transporteMap[transporte].clientes[cliente].bultos += bultos;
            }
        });

        // Agregar datos adicionales de Hoja 1 a los clientes
        hoja1.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const cliente = row.getCell(1).value;
            const riesgoTotal = row.getCell(28).value;
            const menos50m = row.getCell(11).value;
            const accesoSinCruce = row.getCell(12).value;
            const accesoCarro = row.getCell(13).value;
            const ingresoEscaleras = row.getCell(14).value;
            const buenaIluminacion = row.getCell(15).value;
            const seguridad5s = row.getCell(16).value;
            const trabajoAltura = row.getCell(17).value;
            const riesgoElectricidad = row.getCell(18).value;
            const clientesViolentos = row.getCell(19).value;
            const coordenadasx = row.getCell(29).value;
            const coordenadasy = row.getCell(30).value;

            Object.keys(transporteMap).forEach(transporte => {
                if (transporteMap[transporte].clientes[cliente]) {
                    const clienteData = transporteMap[transporte].clientes[cliente];
                    clienteData.riesgoTotal = riesgoTotal;
                    clienteData.menos50m = menos50m;
                    clienteData.accesoSinCruce = accesoSinCruce;
                    clienteData.accesoCarro = accesoCarro;
                    clienteData.ingresoEscaleras = ingresoEscaleras;
                    clienteData.buenaIluminacion = buenaIluminacion;
                    clienteData.seguridad5s = seguridad5s;
                    clienteData.trabajoAltura = trabajoAltura;
                    clienteData.riesgoElectricidad = riesgoElectricidad;
                    clienteData.clientesViolentos = clientesViolentos;
                    clienteData.coordenadasx = coordenadasx;
                    clienteData.coordenadasy = coordenadasy;
                }
            });
        });

        // Procesar Hoja 3
        hoja3.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            datosHoja3.push({
                fecha: row.getCell(1).value,
                chofer: row.getCell(2).value,
                rol: row.getCell(3).value,
                volumen: row.getCell(4).value,
                rechazo: row.getCell(5).value,
                rotura: row.getCell(6).value,
                rutaDigital: row.getCell(7).value,
                adherenciaFrecuencia: row.getCell(8).value,
                excesoVelocidad: row.getCell(9).value,
                dispersionKilometros: row.getCell(10).value
            });
        });

        res.json({ transporteMap, datosHoja3 });

    } catch (error) {
        console.error('❌ Error al procesar datos:', error);
        res.status(500).json({ error: 'Error al leer el archivo Excel', message: error.message });
    }
});

// Servidor
app.listen(port, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
