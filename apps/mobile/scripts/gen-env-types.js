// expo start'ın ürettiği tip referansını CI/typecheck için önceden yazar.
require("fs").writeFileSync("expo-env.d.ts", '/// <reference types="expo/types" />\n');
