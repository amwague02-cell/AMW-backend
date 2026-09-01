const nodemailer = require("nodemailer");


const transporter =
    nodemailer.createTransport({

        service: "gmail",

        auth: {

            user:
                process.env.EMAIL_USER,

            pass:
                process.env.EMAIL_PASSWORD

        }

    });


async function sendPasswordResetCode(
    email,
    code
) {

    await transporter.sendMail({

        from:
            `"A.M.W" <${process.env.EMAIL_USER}>`,

        to:
            email,

        subject:
            "Code de vérification — A.M.W",

        html: `

            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                padding: 30px;
            ">

                <h2>A.M.W</h2>

                <p>
                    Bonjour,
                </p>

                <p>
                    Voici votre code de vérification :
                </p>

                <div style="
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    padding: 20px;
                    text-align: center;
                    background: #f4f4f4;
                ">

                    ${code}

                </div>

                <p>
                    Ce code expire dans 10 minutes.
                </p>

                <p>
                    Si vous n'êtes pas à l'origine
                    de cette demande, ignorez cet e-mail.
                </p>

                <p>
                    L'équipe A.M.W
                </p>

            </div>

        `

    });

}


module.exports = {

    sendPasswordResetCode

};