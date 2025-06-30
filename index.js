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
  origin: 'https://riesgo.onrender.com',
  credentials: true,
};
app.use(cors(corsOptions));

// Servir archivos estáticos (opcional)
app.use(express.static(path.join(__dirname, 'public')));

// Google Drive config
const FILE_ID = '18TiO3g2m1a7lPQhMB9Mol7MO4YtlkqzS';

// Autenticación con cuenta de servicio desde variables de entorno
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    // reemplaza \n por salto de línea real en la clave privada
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

// Función para descargar archivo Excel desde Google Drive
async function descargarArchivoDesdeDrive(fileId, outputPath) {
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    response.data.pipe(dest);
    dest.on('finish', () => {
      console.log(`Archivo descargado en ${outputPath}`);
      resolve(outputPath);
    });
    dest.on('error', (err) => {
      console.error('Error al descargar archivo:', err);
      reject(err);
    });
  });
}

// Endpoint principal
app.get('/get-datos', async (req, res) => {
  const localPath = path.join(__dirname, 'temp.xlsx');

  try {
    console.log('Iniciando descarga del archivo...');
    await descargarArchivoDesdeDrive(FILE_ID, localPath);

    const stats = fs.statSync(localPath);
    if (stats.size === 0) {
      throw new Error('Archivo descargado está vacío');
    }
    console.log(`Archivo descargado, tamaño: ${stats.size} bytes`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(localPath);

    console.log('Hojas disponibles:', workbook.worksheets.map(ws => ws.name));

    const hoja1 = workbook.getWorksheet('Hoja1');
    const hoja2 = workbook.getWorksheet('Hoja2');
    const hoja3 = workbook.getWorksheet('Hoja3');

    if (!hoja1 || !hoja2 || !hoja3) {
      return res.status(400).json({ error: 'No se encontraron las hojas "Hoja1", "Hoja2" o "Hoja3".' });
    }

    // Procesar datos
    const datosHoja1 = [];
    const transporteMap = {};
    const datosHoja3 = [];

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
        coordenadasy: yValue,
      });
    });

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
            menos50m: 'No disponible',
            accesoSinCruce: 'No disponible',
            accesoCarro: 'No disponible',
            ingresoEscaleras: 'No disponible',
            buenaIluminacion: 'No disponible',
            seguridad5s: 'No disponible',
            trabajoAltura: 'No disponible',
            riesgoElectricidad: 'No disponible',
            clientesViolentos: 'No disponible',
          };
        }

        transporteMap[transporte].bultos += bultos;
        transporteMap[transporte].clientes[cliente].bultos += bultos;
      }
    });

    // Agregar info extra de hoja1 a transporteMap
    hoja1.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cliente = row.getCell(1).value;

      Object.keys(transporteMap).forEach((transporte) => {
        if (transporteMap[transporte].clientes[cliente]) {
          const clienteData = transporteMap[transporte].clientes[cliente];
          clienteData.riesgoTotal = row.getCell(28).value;
          clienteData.menos50m = row.getCell(11).value;
          clienteData.accesoSinCruce = row.getCell(12).value;
          clienteData.accesoCarro = row.getCell(13).value;
          clienteData.ingresoEscaleras = row.getCell(14).value;
          clienteData.buenaIluminacion = row.getCell(15).value;
          clienteData.seguridad5s = row.getCell(16).value;
          clienteData.trabajoAltura = row.getCell(17).value;
          clienteData.riesgoElectricidad = row.getCell(18).value;
          clienteData.clientesViolentos = row.getCell(19).value;
          clienteData.coordenadasx = row.getCell(29).value;
          clienteData.coordenadasy = row.getCell(30).value;
        }
      });
    });

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
        dispersionKilometros: row.getCell(10).value,
      });
    });

    // Enviar resultado
    res.json({ transporteMap, datosHoja3 });

    // Borrar archivo temporal
    fs.unlink(localPath, (err) => {
      if (err) console.warn('No se pudo borrar archivo temporal:', err);
      else console.log('Archivo temporal borrado');
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
