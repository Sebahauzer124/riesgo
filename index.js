const express = require('express');
const ExcelJS = require('exceljs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const port = process.env.PORT || 3000;
const app = express();

// Configuración CORS
const corsOptions = {
  origin: 'https://riesgo-ten.vercel.app/',
  credentials: true,
};
app.use(cors(corsOptions));

// Servir archivos estáticos si tenés
app.use(express.static(path.join(__dirname, 'public')));

// Google Drive config
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const FILE_ID = '18TiO3g2m1a7lPQhMB9Mol7MO4YtlkqzS'; // Reemplazá por el ID de tu archivo

// Autenticación con cuenta de servicio desde variable de entorno JSON
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});


async function descargarArchivoDesdeDrive(fileId, outputPath) {
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    response.data.pipe(dest);
    dest.on('finish', () => resolve(outputPath));
    dest.on('error', reject);
  });
}

app.get('/get-datos', async (req, res) => {
  const localPath = path.join(__dirname, 'temp.xlsx');

  try {
    // Descargar archivo Excel desde Google Drive
    await descargarArchivoDesdeDrive(FILE_ID, localPath);

    // Leer Excel con ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(localPath);

    const hoja1 = workbook.getWorksheet('Hoja1');
    const hoja2 = workbook.getWorksheet('Hoja2');
    const hoja3 = workbook.getWorksheet('Hoja3');

    if (!hoja1 || !hoja2 || !hoja3) {
      return res.status(400).json({ error: 'No se encontraron las hojas "Hoja1", "Hoja2" o "Hoja3".' });
    }

    const datosHoja1 = [];
    const transporteMap = {};
    const datosHoja3 = [];

    // Procesar Hoja1
    hoja1.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // saltar encabezado

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
        coordenadasy: yValue,
      });
    });

    // Procesar Hoja2
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

    // Agregar datos adicionales de Hoja1 a clientes de Hoja2
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

    // Procesar Hoja3
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

    // Responder con los datos
    res.json({ transporteMap, datosHoja3 });

    // Opcional: borrar archivo temporal si querés
    fs.unlink(localPath, err => {
      if (err) console.warn('No se pudo borrar archivo temporal:', err);
    });

  } catch (error) {
    console.error('❌ Error al procesar datos:', error);
    res.status(500).json({ error: 'Error al leer el archivo Excel', message: error.message });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
