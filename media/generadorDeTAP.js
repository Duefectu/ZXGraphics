// Generador de .TAP v1.1
//
// Antonio Tamairón - 15/2022
// @hash6iron / hash6iron@gmail.com
//
// Rutina para generar un fichero .TAP a partir de una serie de parámetros:
// - Bloque de datos (bytes en RAW)
// - Dirección de almacenaje en memoria del ZX Spectrum
// - Nombre del fichero (max. 10 caracteres)
//
// Uso: 
//   generateTAP(data, start_address, block_name)
//
//   donde,
//   * data: Bloque de bytes a cargar en memoria del ZX Spectrum
//   * start_address: Dirección a partir de la cual se carga el bloque de bytes
//   * block_name: Nombre para el bloque de datos (tipico nombre que aparece en la carga al lado de byte: xxxxxxxxxx ). Max. 10 caracteres
//
// Primera versión: v1.0
//
// Correcciones: v1.1
// - 17/11/2022
//   * El nombre del fichero en TAP debe ser de 10 bytes siempre, solo se estaban rellenando 9 bytes
//   * Orden incorrecto de longitud y dirección de memoria, en la cabecera
//   * Calculo incorrecto del checksum de la cabecera (se estaban cogiendo menos datos de los necesarios)
//   * Calculo incorrecto del checksum del bloque de datos (se estaban cogiendo menos datos de los necesarios)
//   * Concatenado del byte de checksum. No se estaba haciendo de manera correcta

// Funciones necesarias

function toHexString(byteArray) 
{
    // Función que convierte bytes a hexadecimal
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }

function toByteArray (hexString) {
    // Funcion que pasa de HEX STRING a array de bytes
    var result = [];
    while (hexString.length >= 2) { 
        result.push(parseInt(hexString.substring(0, 2), 16));
        hexString = hexString.substring(2, hexString.length);
    }
    return result;
 }

function putByteInHeaderLittleEndian(header, decimalData, posByte)
{
    // Inyectamos en la cabecera una cadena Hex en little endian
    // desde un valor decimal
    var arrayTAP = new Uint8Array();
    arrayTAP = header;

    // Definimos como es un little endian
    let liEnd=num => num.toString(16).padStart(4,'0').match(/../g).reverse().join('');
    
    // convertimos a hex en little endian
    st_add_hex = liEnd(decimalData);

    // Convertimos el hex en array de bytes
    st_add_bytes = toByteArray(st_add_hex)

    // inyectamos en la arrayTAP
    arrayTAP[posByte] = st_add_bytes[0]
    arrayTAP[posByte+1] = st_add_bytes[1]

    return arrayTAP;
}

function checksum(header)
{
    var cs = 0;
    for (n=0;n<=header.length;n++)
    {
        // Recorremos todo el bloque calculando el checksum XOR
        cs = cs ^ header[n];
    }

    return cs;
}

function generateTAP(data, start_address, block_name) 
{
    // Función principal que genera el conjunto de datos para 
    // ser volcado directamente a fichero y ser reconocido como
    // un fichero .TAP

    // Esta función genera bloques .TAP de binarios.
    
    // NOTA: GDU - 168 bytes
    //       FNT - 768 bytes

    // Ahora cogemos el bloque de datos y generamos la cabecera
    var arrayTAP = new Uint8Array();
    var posByte = 0;
    arrayTAP = [0x13,0x00,0x00,0x03]

    if (block_name.length >= 10)
    {
        // Si el nombre del bloque es mayor de 10 caracteres lo acortamos
        block_name = block_name.substring(1,10);
    }
    else
    {
        block_name = block_name + ' '.repeat(10-block_name.length)
    }

    // Convertimos el nombre a bytes
    var block_name_hex = new Uint8Array()
    for (var n=0;n<block_name.length;n++)
    {
        //console.log(block_name[n]);
        // Lo añadimos directamente a la cabecera
        arrayTAP[n+4] = block_name.charCodeAt(n);
        posByte = n+4;
    }
   
    // Longitud del bloque de datos
    data_lenght = data.length
    arrayTAP = putByteInHeaderLittleEndian(arrayTAP, data_lenght, 14);

    // Ahora añadimos la dirección de inicio en little endian
    arrayTAP = putByteInHeaderLittleEndian(arrayTAP, start_address, 16);
    
    // Reservado - 32768 para bloques de codigo y SCREEN
    arrayTAP = putByteInHeaderLittleEndian(arrayTAP, 32768, 18);

    // Ahora calculamos el checksum desde el byte nº2 (empezando por la pos. 0)
    var sub_header = new Uint8Array()
    sub_header = arrayTAP.slice(2)
    arrayTAP[20] = checksum(sub_header)
    
    // Ahora vamos a añadir la arrayTAP para el bloque de código con el FLAG 0xFF
    // Longitud + 2 (2 bytes mas, uno por el flag 0xFF y otro por el checksum del final del bloque)
    arrayTAP = putByteInHeaderLittleEndian(arrayTAP, data_lenght+2, 21);
    // Ahora añadimos el flag 0xFF
    arrayTAP[23] = 255

    // Ahora añadimos el bloque completo byte a byte
    for (n=0;n<data.length;n++)
    {
        // Leemos cada byte y lo añadimos al bloque de codigo
        arrayTAP[24+n] = data[n]
    }
    // Añadimos el checksum. Este se calcula incluyendo el flag FF por lo tanto desde el byte 23
    var chkByte = checksum(arrayTAP.slice(23));
    arrayTAP = arrayTAP.concat([chkByte]);

    // Devolvemos el TAP
    return arrayTAP;
}