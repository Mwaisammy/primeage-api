import {Request, Response} from 'express'
import bycrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import "dotenv/config"


import { createUserService, getUserByEmailService, userLoginService, verifyUserService } from './auth.service'
import { sendMail } from '../mailer/mailer'

export const createUserController = async(req: Request, res:Response) => {
    try {
        const user = req.body

        // Check if user already exists by email
    const existingUser = await getUserByEmailService(user.email);
    if (existingUser) {
      // This is the check to ensure a user is not created twice
      return res.status(400).json({ message: "User with this email already exists" });
    }

    
        const password = user.password
        const hashedPassword =  bycrypt.hashSync(password, 10)
                user.password = hashedPassword 

        //generate 6 digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
        user.verificationCode = verificationCode
        user.isVerified = false

const createUser = await createUserService(user)
        if(!createUser) return res.json({message: "User not created"})
            try {
        await sendMail(
            user.email,
            `Account Verification`, // subject
            `Hello ${user.firstname}, your verification code is: ${verificationCode}`, // plain text
            `<div>
                <h1>Hello ${user.lastname},</h1>
                <p>your verification code is: <strong>${verificationCode}</strong></p>
                <p>Enter this code to verify your account.</p>
            </div>` // html

        )
        // console.log("Email", user.email)
                
            } catch (emailError) {
                console.error("Failed to send registration email", emailError)

            }
        return res.json({message: "User created successfully"})        
    } catch (error: any) {

        return res.status(500).json({error: error.message})
        
    }
}


export const loginUserController = async(req: Request, res:Response) => {

    const user = req.body

    //check if user exist

    const userExist = await userLoginService(user)

    if(!userExist){
        return res.status(404).json({message: "User not found"})
    }

    //create payload

    //create payload

    const payload = {
        sub: userExist.userId,
        userId: userExist.userId,
        firstname: userExist.firstname,
        lastname: userExist.lastname,
        role: userExist.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 //token expires in one day

         
    }


        try {
        //generate the JWT token
    const secret = process.env.JWT_SECRET as string
    if(!secret){
        return res.status(500).json({message: "JWT secret not found"})
    }

    const token = jwt.sign(payload, secret)
    if(!token){
        return res.status(500).json({message: "Token not generated"})
    }
    return res.status(200).json({
        message: "Login successful", 
        token: token,
        user: {
            userId: userExist.userId,
            firstname: userExist.firstname,
            lastname: userExist.lastname,
            email: userExist.email,
            role: userExist.role
        }

    })
        
    } catch (error: any) {
        return res.status(500).json({message: "Error generating token"})
        
    }



}

export const verifyUserController = async(req: Request, res:Response) => {
    try {

        const { email, verificationCode } = req.body

        if(!email || !verificationCode) {
           return res.status(400).json({ message: "Email and verification code are required to verify your account." }); 
        }

        try {

            const user = await getUserByEmailService(email)

            //if no user found
        
            if(!user){
                return res.status(404).json({message: "User not found with the provided email address."})
            }

  // Check if the account is already verified to prevent redundant operations
        if (user.isVerified) {
            return res.status(400).json({ message: "Account is already verified." });
        } 
        
        //Successful verification

        await verifyUserService(email)

        //send verification email - success

         try {
                if (typeof user.email === "string") {
                    await sendMail(
                        user.email,
                        "Account Verification Successful - Welcome!",
                        `Hello ${user.lastname},\n\nYour account has been successfully verified!\n\nYou can now log in and enjoy our services.\n\nThank you for choosing us!`, 
                        `<div>
                            <h2>Hello ${user.lastname},</h2>
                            <p>Your account has been successfully verified!</p>
                            <p>You can now log in and enjoy our services.</p>
                            <p>Thank you for choosing us!</p>
                        </div>` 
                    );
                } else {
                    throw new Error("User email is missing or invalid.");
                }
               
            } catch (emailError: any) {
                
                
                return res.status(200).json({
                    message: "Account verified successfully, but there was an issue sending the confirmation email.",
                    emailError: emailError.message // Optionally include error details
                });
            }

        

        } catch (error:any) {
             console.error("Error in verifyUserController:", error);
        return res.status(500).json({ error: error.message || "Internal server error during account verification." });
        }
        
    } catch (error: any) {
        
    }
}


