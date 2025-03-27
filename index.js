const express = require('express');
const ExcelJS = require('exceljs');
const cors = require('cors');
const path = require('path');
const port = process.env.PORT || 3000;
const app = express();

const corsOptions = {
    origin: 'https://riesgo-ten.vercel.app/',  // Cambia esto por tu dominio frontend
    credentials: true,  // Permite enviar cookies de terceros
  };
  app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, 'public')));

const archivoExcel = path.join(process.cwd(), 'public', 'Libro1.xlsx');

app.get('/get-datos', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(archivoExcel);

        const hoja1 = workbook.getWorksheet('Hoja1');
        const hoja2 = workbook.getWorksheet('Hoja2');
        const hoja3 = workbook.getWorksheet('Hoja3');

        if (!hoja1 || !hoja2 || !hoja3) {
            return res.status(400).json({ error: 'No se pudieron encontrar las hojas "Hoja1", "Hoja2" o "Hoja3" en el archivo Excel.' });
        }

        const datosHoja1 = [];
        const transporteMap = {};
        const datosHoja3 = [];

        // Procesar Hoja 1
        hoja1.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Omitir encabezados

            // Leer los valores de las coordenadas (en las columnas 29 y 30)
            const coordenadasx = row.getCell(29).value;
            const coordenadasy = row.getCell(30).value;

            // Extraer solo el valor calculado de las coordenadas (si es un objeto)
            const xValue = coordenadasx && coordenadasx.result !== undefined ? coordenadasx.result : coordenadasx;
            const yValue = coordenadasy && coordenadasy.result !== undefined ? coordenadasy.result : coordenadasy;

            // Imprimir las coordenadas
            console.log(`Fila ${rowNumber} - Coordenadas x:`, xValue);
            console.log(`Fila ${rowNumber} - Coordenadas y:`, yValue);

            // Validar que las coordenadas no estén vacías o nulas
            if (xValue && yValue) {
                console.log(`Coordenadas de cliente (fila ${rowNumber}): x = ${xValue}, y = ${yValue}`);
            } else {
                console.warn(`⚠️ Cliente sin coordenadas en la fila ${rowNumber}:`, row.getCell(1).value);
            }

            // Añadir cliente a datosHoja1 con coordenadas normalizadas
            datosHoja1.push({
                cliente: row.getCell(1).value, // Columna A
                pdv: row.getCell(3).value, // Columna C
                menos50m: row.getCell(11).value, // Columna K
                accesoSinCruce: row.getCell(12).value, // Columna L
                accesoCarro: row.getCell(13).value, // Columna M
                ingresoEscaleras: row.getCell(14).value, // Columna N
                buenaIluminacion: row.getCell(15).value, // Columna O
                seguridad5s: row.getCell(16).value, // Columna P
                trabajoAltura: row.getCell(17).value, // Columna Q
                riesgoElectricidad: row.getCell(18).value, // Columna R
                clientesViolentos: row.getCell(19).value, // Columna S
                manejaEfectivo: row.getCell(20).value, // Columna T
                animalesSueltos: row.getCell(21).value, // Columna U
                zonaEscolar: row.getCell(22).value, // Columna V
                caminoTransitable: row.getCell(23).value, // Columna W
                zonaPeligrosa: row.getCell(24).value, // Columna X
                riesgoTotal: row.getCell(28).value, // Columna AB
                coordenadasx: xValue ,
                coordenadasy: yValue 
            });
        });

        // Procesar Hoja 2 (sumar bultos por cliente y agrupar transporte)
        hoja2.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Omitir encabezados

            const transporte = row.getCell(43).value; // Columna V (Transporte)
            const cliente = row.getCell(23).value; // Columna X (Cliente)
            const descripcionCliente = row.getCell(25).value; // Columna Y (Descripción Cliente)
            const bultos = row.getCell(11).value; // Columna K (Bultos)

            if (transporte) {
                if (!transporteMap[transporte]) {
                    transporteMap[transporte] = {
                        bultos: 0,
                        clientes: {}
                    };
                }

                if (!transporteMap[transporte].clientes[cliente]) {
                    // Si el cliente no está en el transporte, agregarlo
                    transporteMap[transporte].clientes[cliente] = {
                        descripcionCliente,
                        bultos: 0,
                        riesgoTotal: 0, // Inicializar el riesgo total
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

                // Sumar los bultos
                transporteMap[transporte].bultos += bultos;
                transporteMap[transporte].clientes[cliente].bultos += bultos;
            }
        });

        // Añadir los datos de la Hoja 1 a los clientes de la Hoja 2
        hoja1.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Omitir encabezados

            const cliente = row.getCell(1).value; // Columna A (Cliente)
            const riesgoTotal = row.getCell(28).value; // Columna AB (Riesgo Total)
            const menos50m = row.getCell(11).value; // Columna K (Menos de 50m)
            const accesoSinCruce = row.getCell(12).value; // Columna L
            const accesoCarro = row.getCell(13).value; // Columna M
            const ingresoEscaleras = row.getCell(14).value; // Columna N
            const buenaIluminacion = row.getCell(15).value; // Columna O
            const seguridad5s = row.getCell(16).value; // Columna P
            const trabajoAltura = row.getCell(17).value; // Columna Q
            const riesgoElectricidad = row.getCell(18).value; // Columna R
            const clientesViolentos = row.getCell(19).value; // Columna S
            const coordenadasx = row.getCell(29).value; // Columna AC
            const coordenadasy = row.getCell(30).value; // Columna AD

            // Si el cliente existe en la Hoja 2, añadir los datos de la Hoja 1
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
                if (rowNumber === 1) return; // Omitir encabezados
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

        res.json({ transporteMap,datosHoja3 });


    } catch (error) {
        console.error('Error al leer el archivo Excel:', error);
        res.status(500).json({ error: 'Error al leer el archivo Excel', message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
