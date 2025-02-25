const express = require('express');

const router = express.Router();
const config = require('../config/index')
const { dataSource } = require('../db/data-source');
const logger = require('../utils/logger')('CreditPackage');
const auth = require('../middlewares/auth')({
    secret: config.get('secret').jwtSecret,
    userRepository: dataSource.getRepository('User'),
    logger
});
const { isUndefined, isNotValidString, isNotValidInteger } = require('../utils/validUtils');

router.get('/', async (req, res, next) => {
    try{
        const creditPackage = await dataSource.getRepository('CreditPackage').find({
            select: ['id','name','credit_amount','price']
        });
        res.status(200).json({
            status: 'success',
            data: creditPackage
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.post('/', async (req, res, next) => {
    try{
        const { name, credit_amount: creditAmount, price } = req.body;
        if( isUndefined(name) || isNotValidString(name) || 
            isUndefined(creditAmount) || isNotValidInteger(creditAmount) ||
            isUndefined(price) || isNotValidInteger(price)){
                res.status(400).json({
                    status: 'failed',
                    message: '欄位未填寫正確'
                });
                return;
        };

        const creditPackageRepo = await dataSource.getRepository('CreditPackage');
        const existCreditPurchase = await creditPackageRepo.findOne({
            where: { name }
        });
        if(existCreditPurchase){
            res.status(409).json({
                status: 'failed',
                message: '資料重複'
            });
            return;
        };

        const newCreditPurchase = await creditPackageRepo.create({
            name,
            credit_amount: creditAmount,
            price
        });
        const result = await creditPackageRepo.save(newCreditPurchase);
        res.status(200).json({
            status: 'success',
            data: result
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.post('/:creditPackageId', auth, async (req, res, next) => {
    try{
        const { id } = req.user;
        const { creditPackageId } = req.params;
        const creditPackageRepo = await dataSource.getRepository('CreditPackage');
        const creditPackage = await creditPackageRepo.findOneBy({ id: creditPackageId });
        if(!creditPackage){
            res.status(400).json({
                status: 'failed',
                message: 'ID錯誤'
            });
            return;
        };
        const creditPurchaseRepo = await dataSource.getRepository('CreditPurchase');
        const newPurchase = await creditPurchaseRepo.create({
            user_id: id,
            credit_package_id: creditPackageId,
            purchased_credits: creditPackage.credit_amount,
            price_paid: creditPackage.price,
            purchaseAt: new Date().toISOString()
        });
        await creditPurchaseRepo.save(newPurchase);
        res.status(200).json({
            status: 'success',
            data: null
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

router.delete('/:creditPackageId', auth, async (req, res, next) => {
    try{
        const { creditPackageId } = req.params;
        if(isUndefined(creditPackageId) || isNotValidString(creditPackageId)){
            res.status(400).json({
                status: 'failed',
                message: '欄位未填寫正確'
            });
            return;
        };

        const result = await dataSource.getRepository('CreditPackage').delete(creditPackageId);
        if(result.affected === 0){
            res.status(400).json({
                status: 'failed',
                message: 'ID錯誤'
            });
            return;
        }
        
        res.status(200).json({
            status: 'success',
            data: result
        });
    }catch(error){
        logger.error(error);
        next(error);
    };
});

module.exports = router;