const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();
const config = require('../config/index');
const { dataSource } = require('../db/data-source');
const logger = require('../utils/logger')('Users');
const generateJWT = require('../utils/generateJWT');
const auth = require('../middlewares/auth')({
    secret: config.get('secret').jwtSecret,
    userRepository: dataSource.getRepository('User'),
    logger
});

const { isUndefined, isNotValidString } = require('../utils/validUtils');

router.post('/signup', async (req,res,next) => {
    try{
        const emailPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;
        const { name, email, password } = req.body;
        if( isUndefined(name) || isNotValidString(name) ||
            isUndefined(email) || isNotValidString(email) ||
            isUndefined(password) || isNotValidString(password)){
                logger.warn('欄位未填寫正確');
                res.status(400).json({
                    status: 'failed',
                    message: '欄位未填寫正確'
                });
                return;
        };
        if(!emailPattern.test(email)){
            logger.warn('信箱不符合規則');
            res.status(400).json({
                status: 'failed',
                message: '信箱不符合規則'
            });
            return;
        };
        if(!passwordPattern.test(password)){
            logger.warn('建立使用者錯誤: 密碼不符合規則，需要包含數字和大小寫英文，最短8個字，最長16個字');
            res.status(400).json({
                status: 'failed',
                message: '密碼不符合規則，需要包含數字和大小寫英文，最短8個字，最長16個字'
            });
            return;
        };
        
        const userRepo = await dataSource.getRepository('User');
        const existingUser = await userRepo.findOneBy({ email });
        if(existingUser){
            logger.warn('建立使用者錯誤: Email已被使用');
            res.status(409).json({
                status: 'failed',
                message: 'Email已被使用'
            });
            return;
        };

        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);
        const newUser = await userRepo.create({
            name,
            email,
            role: 'USER',
            password: hashPassword
        });
        const savedUser = await userRepo.save(newUser);
        logger.info('新建立的使用者ID:', savedUser.id);

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: savedUser.id,
                    name: savedUser.name
                }
            }
        });
    }catch(error){
        logger.error('建立使用者錯誤:',error);
        next(error);
   }; 
});

router.post('/login', async (req,res,next) => {
    try{
        const emailPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;
        const { email,password } = req.body;
        if (isUndefined(email) || isNotValidString(email) ||
            isUndefined(password) || isNotValidString(password)){
            logger.warn('欄位未填寫正確');
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };
        if(!emailPattern.test(email)){
            logger.warn('信箱不符合規則');
            res.status(400).json({
                status: 'failed',
                message: '信箱不符合規則'
            });
            return;
        };
        if(!passwordPattern.test(password)){
            logger.warn('密碼不符合規則，需要包含數字和大小寫英文，最短8個字，最長16個字');
            res.status(400).json({
                status: 'failed',
                message: '密碼不符合規則，需要包含數字和大小寫英文，最短8個字，最長16個字'
            });
            return;
        };
        const userRepo = await dataSource.getRepository('User');
        const existingUser = await userRepo.findOne({
            select: ['id','name','password'],
            where: { email }
        });
        if(!existingUser){
            res.status(400).json({
                status: 'failed',
                message: '使用者不存在'
            });
            return;
        };
        logger.info(`使用者資料: ${JSON.stringify(existingUser)}`);
        const isMatch = await bcrypt.compare(password, existingUser.password);
        if(!isMatch){
            res.status(400).json({
                status: 'failed',
                message: '密碼輸入錯誤'
            });
            return;
        };
        const token = await generateJWT({
            id: existingUser.id
        }, config.get('secret.jwtSecret'), {
            expiresIn: `${config.get('secret.jwtExpiresDay')}`
        });

        res.status(201).json({
            status: 'success',
            data: {
                token,
                user: {
                    name: existingUser.name
                }
            }
        });        
    }catch(error){
        logger.error('登入錯誤', error);
        next(error);
    };
});

router.get('/profile', auth, async (req,res,next) => {
    try{
        const { id } = req.user;
        const userRepo = await dataSource.getRepository('User');
        const user = await userRepo.findOne({
            select: ['name', 'email'],
            where: { id }
        });
        res.status(200).json({
            status: 'success',
            data: {
                user
            }
        });
    }catch(error){
        logger.error('取得使用者資料錯誤:',error);
        next(error);
    }
});

router.put('/profile', auth, async (req,res,next) => {
    try{
        const { id } = req.user;
        const { name } = req.body;
        if(isUndefined(name) || isNotValidString(name)){
            logger.warn('欄位未填寫正確');
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };
        const userRepo = await dataSource.getRepository('User');
        const user = await userRepo.findOne({
            select: ['name'],
            where: { id }
        });
        if(user.name === name){
            res.status(400).json({
                status: 'failed',
                message: '使用者名稱未改變'
            });
            return;
        };
        const updatedResult = await userRepo.update({
            id,
            name: user.name
        },{
            name
        });
        if(updatedResult.affected === 0){
            res.status(400).json({
                status: 'failed',
                message: '使用者資料更新失敗'
            });
            return;
        };
        const result = await userRepo.findOne({
            select: ['name'],
            where: { id }
        });
        res.status(200).json({
            status: 'success',
            data: {
                user: result
            }
        });
    }catch(error){
        logger.error('取得使用者資料錯誤:',error);
        next(error);
    };    
});

module.exports = router;